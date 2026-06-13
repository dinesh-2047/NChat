'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

function formatTime(d){const dt=new Date(d);return dt.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
function formatLastSeen(d){if(!d)return'';const now=new Date(),dt=new Date(d),diff=now-dt;if(diff<60000)return'just now';if(diff<3600000)return Math.floor(diff/60000)+'m ago';if(diff<86400000)return Math.floor(diff/3600000)+'h ago';return dt.toLocaleDateString()}
function getInitial(n){return n?n[0].toUpperCase():'?'}

export default function ChatPage(){
  const{user,loading:authLoading,logout}=useAuth();
  const router=useRouter();
  const[convs,setConvs]=useState([]);
  const[activeConv,setActiveConv]=useState(null);
  const[messages,setMessages]=useState([]);
  const[msgInput,setMsgInput]=useState('');
  const[searchQuery,setSearchQuery]=useState('');
  const[searchResults,setSearchResults]=useState([]);
  const[showSearch,setShowSearch]=useState(false);
  const[typingUsers,setTypingUsers]=useState([]);
  const[showAttach,setShowAttach]=useState(false);
  const[recording,setRecording]=useState(false);
  const[recordTime,setRecordTime]=useState(0);
  const[showMobile,setShowMobile]=useState('sidebar');
  const[callState,setCallState]=useState(null);
  const[localStream,setLocalStream]=useState(null);
  const[remoteStream,setRemoteStream]=useState(null);
  const[isMuted,setIsMuted]=useState(false);
  const[isVideoOff,setIsVideoOff]=useState(false);
  const[deleteModalMsg,setDeleteModalMsg]=useState(null);
  const messagesEndRef=useRef(null);
  const mediaRecorderRef=useRef(null);
  const audioChunksRef=useRef([]);
  const recordIntervalRef=useRef(null);
  const peerConnectionRef=useRef(null);
  const localVideoRef=useRef(null);
  const remoteVideoRef=useRef(null);
  const fileInputRef=useRef(null);
  const typingTimeoutRef=useRef(null);
  const lastPollRef=useRef(null);

  useEffect(()=>{if(!authLoading&&!user)router.push('/auth')},[user,authLoading,router]);

  // Fetch conversations
  const fetchConvs=useCallback(async()=>{
    try{const r=await fetch('/api/conversations');if(r.ok){const d=await r.json();setConvs(d.conversations||[])}}catch{}
  },[]);

  useEffect(()=>{if(user){fetchConvs();const i=setInterval(fetchConvs,3000);return()=>clearInterval(i)}},[user,fetchConvs]);

  // Fetch messages for active conversation
  const fetchMessages=useCallback(async(convId,poll=false)=>{
    try{
      let url=`/api/messages/${convId}`;
      if(poll&&lastPollRef.current)url+=`?after=${lastPollRef.current}`;
      const r=await fetch(url);
      if(r.ok){
        const d=await r.json();
        if(poll&&lastPollRef.current){
          if(d.messages.length>0){setMessages(prev=>{const ids=new Set(prev.map(m=>m._id));return[...prev,...d.messages.filter(m=>!ids.has(m._id))]});await fetch(`/api/messages/${convId}/seen`,{method:'POST'})}
        }else{setMessages(d.messages||[]);await fetch(`/api/messages/${convId}/seen`,{method:'POST'})}
        if(d.messages.length>0)lastPollRef.current=d.messages[d.messages.length-1].createdAt;
      }
    }catch{}
  },[]);

  useEffect(()=>{
    if(activeConv){
      lastPollRef.current=null;
      fetchMessages(activeConv.conversationId);
      const i=setInterval(()=>fetchMessages(activeConv.conversationId,true),2000);
      return()=>clearInterval(i);
    }
  },[activeConv,fetchMessages]);

  // Poll typing status
  useEffect(()=>{
    if(!activeConv)return;
    const i=setInterval(async()=>{
      try{const r=await fetch(`/api/status/typing?conversationId=${activeConv.conversationId}`);if(r.ok){const d=await r.json();setTypingUsers(d.typingUsers||[])}}catch{}
    },2000);
    return()=>clearInterval(i);
  },[activeConv]);

  // Poll message statuses
  useEffect(()=>{
    if(!activeConv||messages.length===0)return;
    const myMsgs=messages.filter(m=>m.sender?._id===user?.id&&m.status!=='seen');
    if(myMsgs.length===0)return;
    const i=setInterval(async()=>{
      const ids=myMsgs.map(m=>m._id).join(',');
      try{const r=await fetch(`/api/messages/${activeConv.conversationId}/status?ids=${ids}`);if(r.ok){const d=await r.json();if(d.statuses){setMessages(prev=>prev.map(m=>d.statuses[m._id]?{...m,status:d.statuses[m._id]}:m))}}}catch{}
    },3000);
    return()=>clearInterval(i);
  },[activeConv,messages,user]);

  // Poll call signals
  useEffect(()=>{
    if(!user)return;
    const i=setInterval(async()=>{
      try{
        const r=await fetch('/api/call/signal');
        if(r.ok){const d=await r.json();for(const s of(d.signals||[])){handleSignal(s)}}
      }catch{}
    },1000);
    return()=>clearInterval(i);
  },[user]);

  // Auto scroll
  useEffect(()=>{messagesEndRef.current?.scrollIntoView({behavior:'smooth'})},[messages]);

  const handleSignal=async(signal)=>{
    if(signal.type==='call-request'){
      if(callState)return sendSignal(signal.from,'call-busy',{});
      setCallState({type:'incoming',from:signal.from,callType:signal.callType,username:signal.data?.username||'Unknown'});
    }else if(signal.type==='call-end'||signal.type==='call-reject'||signal.type==='call-busy'){
      endCall();
    }else if(signal.type==='answer'&&peerConnectionRef.current){
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal.data));
    }else if(signal.type==='offer'){
      await handleOffer(signal);
    }else if(signal.type==='ice-candidate'&&peerConnectionRef.current){
      try{await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(signal.data))}catch{}
    }else if(signal.type==='message-deleted'){
      setMessages(prev=>prev.map(m=>m._id===signal.data.messageId?{...m,type:'deleted',content:'This message was deleted',fileName:''}:m));
    }
  };

  const sendSignal=async(to,type,data,callType)=>{
    await fetch('/api/call/signal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to,type,data,callType})});
  };

  const startCall=async(callType)=>{
    if(!activeConv)return;
    const other=activeConv.participants?.find(p=>p._id!==user.id);
    if(!other)return;
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:callType==='video'});
      setLocalStream(stream);
      setCallState({type:'outgoing',to:other._id,callType,username:other.username});
      await sendSignal(other._id,'call-request',{username:user.username},callType);
      const pc=createPeerConnection(other._id,stream);
      const offer=await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal(other._id,'offer',offer,callType);
    }catch(e){console.error(e);setCallState(null)}
  };

  const acceptCall=async()=>{
    if(!callState)return;
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:callState.callType==='video'});
      setLocalStream(stream);
      createPeerConnection(callState.from,stream);
      setCallState(prev=>({...prev,type:'active'}));
    }catch(e){console.error(e);endCall()}
  };

  const handleOffer=async(signal)=>{
    if(!peerConnectionRef.current)return;
    await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal.data));
    const answer=await peerConnectionRef.current.createAnswer();
    await peerConnectionRef.current.setLocalDescription(answer);
    await sendSignal(signal.from,'answer',answer);
  };

  const createPeerConnection=(targetId,stream)=>{
    const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}]});
    stream.getTracks().forEach(t=>pc.addTrack(t,stream));
    pc.ontrack=(e)=>{setRemoteStream(e.streams[0])};
    pc.onicecandidate=(e)=>{if(e.candidate)sendSignal(targetId,'ice-candidate',e.candidate)};
    peerConnectionRef.current=pc;
    return pc;
  };

  const endCall=()=>{
    if(callState){const id=callState.to||callState.from;if(id)sendSignal(id,'call-end',{})}
    peerConnectionRef.current?.close();peerConnectionRef.current=null;
    localStream?.getTracks().forEach(t=>t.stop());setLocalStream(null);setRemoteStream(null);
    setCallState(null);setIsMuted(false);setIsVideoOff(false);
  };

  const rejectCall=()=>{
    if(callState?.from)sendSignal(callState.from,'call-reject',{});
    setCallState(null);
  };

  const toggleMute=()=>{if(localStream){localStream.getAudioTracks().forEach(t=>t.enabled=!t.enabled);setIsMuted(!isMuted)}};
  const toggleVideo=()=>{if(localStream){localStream.getVideoTracks().forEach(t=>t.enabled=!t.enabled);setIsVideoOff(!isVideoOff)}};

  useEffect(()=>{if(localVideoRef.current&&localStream)localVideoRef.current.srcObject=localStream},[localStream]);
  useEffect(()=>{if(remoteVideoRef.current&&remoteStream)remoteVideoRef.current.srcObject=remoteStream},[remoteStream]);

  const sendMessage=async(content,type='text',extra={})=>{
    if(!activeConv||!content.trim())return;
    const other=activeConv.participants?.find(p=>p._id!==user.id);
    if(!other)return;
    const optimistic={_id:'temp_'+Date.now(),sender:{_id:user.id,username:user.username},receiver:{_id:other._id},content,type,status:'sent',createdAt:new Date().toISOString(),...extra};
    setMessages(prev=>[...prev,optimistic]);
    setMsgInput('');
    try{
      const r=await fetch(`/api/messages/${activeConv.conversationId}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content,type,receiverId:other._id,...extra})});
      if(r.ok){const d=await r.json();setMessages(prev=>prev.map(m=>m._id===optimistic._id?d.message:m));fetchConvs()}
    }catch{}
    sendTypingStatus(false);
  };

  const handleKeyDown=(e)=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage(msgInput)}};

  const sendTypingStatus=(isTyping)=>{
    if(!activeConv)return;
    fetch('/api/status/typing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({conversationId:activeConv.conversationId,isTyping})}).catch(()=>{});
  };

  const handleInputChange=(e)=>{
    setMsgInput(e.target.value);
    sendTypingStatus(true);
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current=setTimeout(()=>sendTypingStatus(false),3000);
  };

  const handleFileUpload=async(e,type)=>{
    const file=e.target.files?.[0];if(!file)return;
    setShowAttach(false);
    const fd=new FormData();fd.append('file',file);fd.append('type',type);
    try{
      const r=await fetch('/api/upload',{method:'POST',body:fd});
      if(r.ok){const d=await r.json();sendMessage(d.url,type,{fileName:file.name,fileSize:file.size,duration:d.duration||0})}
    }catch{}
  };

  const startRecording=async()=>{
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const mr=new MediaRecorder(stream);audioChunksRef.current=[];
      mr.ondataavailable=(e)=>audioChunksRef.current.push(e.data);
      mr.onstop=async()=>{
        stream.getTracks().forEach(t=>t.stop());
        const blob=new Blob(audioChunksRef.current,{type:'audio/webm'});
        const file=new File([blob],'voice_message.webm',{type:'audio/webm'});
        const fd=new FormData();fd.append('file',file);fd.append('type','audio');
        try{const r=await fetch('/api/upload',{method:'POST',body:fd});if(r.ok){const d=await r.json();sendMessage(d.url,'audio',{duration:recordTime})}}catch{}
        setRecording(false);setRecordTime(0);
      };
      mr.start();mediaRecorderRef.current=mr;setRecording(true);
      let t=0;recordIntervalRef.current=setInterval(()=>{t++;setRecordTime(t)},1000);
    }catch{}
  };

  const stopRecording=()=>{mediaRecorderRef.current?.stop();clearInterval(recordIntervalRef.current)};
  const cancelRecording=()=>{mediaRecorderRef.current?.stop();clearInterval(recordIntervalRef.current);audioChunksRef.current=[];setRecording(false);setRecordTime(0)};

  const searchUsers=async(q)=>{
    setSearchQuery(q);if(q.length<2){setSearchResults([]);return}
    try{const r=await fetch(`/api/users/search?q=${q}`);if(r.ok){const d=await r.json();setSearchResults(d.users||[])}}catch{}
  };

  const startConversation=async(username)=>{
    try{
      const r=await fetch('/api/conversations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username})});
      if(r.ok){const d=await r.json();setActiveConv(d.conversation);setShowSearch(false);setSearchQuery('');setSearchResults([]);setShowMobile('chat');fetchConvs()}
    }catch{}
  };

  const selectConv=(conv)=>{setActiveConv(conv);setShowMobile('chat');lastPollRef.current=null};
  const getOtherUser=(conv)=>conv?.participants?.find(p=>p._id!==user?.id);

  const handleDeleteMessage=async(msgId,deleteForEveryone)=>{
    if(!activeConv)return;
    const type=deleteForEveryone?'everyone':'me';
    try{
      const r=await fetch(`/api/messages/${activeConv.conversationId}/${msgId}?type=${type}`,{method:'DELETE'});
      if(r.ok){
        if(deleteForEveryone){
          setMessages(prev=>prev.map(m=>m._id===msgId?{...m,type:'deleted',content:'This message was deleted',fileName:''}:m));
        }else{
          setMessages(prev=>prev.filter(m=>m._id!==msgId));
        }
      }
    }catch{}
  };

  const handleDeleteClick=(msg)=>{
    if(msg.type!=='deleted'){
      setDeleteModalMsg(msg);
    }
  };

  const confirmDelete=(forEveryone)=>{
    if(deleteModalMsg){
      handleDeleteMessage(deleteModalMsg._id,forEveryone);
      setDeleteModalMsg(null);
    }
  };

  const handleClearChat=async()=>{
    if(window.confirm("Clear this chat from your screen?\n(Messages will not be deleted from the database)")){
      try{
        if(activeConv) await fetch(`/api/conversations/${activeConv.conversationId}/clear`, { method: 'POST' });
        setMessages([]);
        fetchConvs();
      }catch{}
    }
  };

  const handleDeleteChat=async()=>{
    if(window.confirm("Delete this chat entirely?\n(This removes the person from your list and clears your messages)")){
      try{
        if(activeConv) await fetch(`/api/conversations/${activeConv.conversationId}`, { method: 'DELETE' });
        setActiveConv(null);
        setMessages([]);
        setShowMobile('sidebar');
        fetchConvs();
      }catch{}
    }
  };

  const renderTicks=(status)=>{
    if(status==='sent')return <span className="msg-ticks sent">✓</span>;
    if(status==='delivered')return <span className="msg-ticks delivered">✓✓</span>;
    if(status==='seen')return <span className="msg-ticks seen">✓✓</span>;
    return null;
  };

  const renderMsgContent=(msg)=>{
    if(msg.type==='deleted')return <p className="msg-text" style={{fontStyle:'italic',color:'var(--text-muted)'}}>🚫 {msg.content}</p>;
    if(msg.type==='image')return <div className="msg-image"><img src={msg.content} alt="img" onClick={()=>window.open(msg.content,'_blank')}/></div>;
    if(msg.type==='video')return <div className="msg-video"><video src={msg.content} controls/></div>;
    if(msg.type==='audio')return <div className="msg-audio"><audio src={msg.content} controls/></div>;
    return <p className="msg-text">{msg.content}</p>;
  };

  if(authLoading)return <div className="chat-layout" style={{alignItems:'center',justifyContent:'center'}}><p style={{color:'var(--accent)',fontFamily:'var(--font-mono)'}}>Loading...</p></div>;
  if(!user)return null;

  const otherUser=getOtherUser(activeConv);

  return(
    <div className="chat-layout">
      {/* SIDEBAR */}
      <div className={`sidebar ${showMobile==='chat'?'hidden':''}`}>
        <div className="sidebar-header">
          <h2>N://Chat</h2>
          <div className="sidebar-actions">
            <button className="icon-btn" onClick={()=>setShowSearch(true)} title="New Chat">+</button>
            <button className="icon-btn" onClick={logout} title="Logout" style={{fontSize:'0.8rem'}}>⏻</button>
          </div>
        </div>
        <div className="sidebar-search">
          <div className="search-input-wrap">
            <span className="search-icon">🔍</span>
            <input placeholder="Search conversations..." value={searchQuery} onChange={(e)=>{setSearchQuery(e.target.value);if(e.target.value.length>=2)searchUsers(e.target.value)}} onFocus={()=>setShowSearch(true)}/>
          </div>
        </div>
        {showSearch&&searchResults.length>0&&(
          <div style={{padding:'8px 16px',borderBottom:'2px solid var(--border)'}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'8px'}}><span style={{fontSize:'0.8rem',color:'var(--text-secondary)'}}>Search Results</span><button onClick={()=>{setShowSearch(false);setSearchResults([]);setSearchQuery('')}} style={{background:'none',border:'none',color:'var(--text-muted)',cursor:'pointer'}}>✕</button></div>
            {searchResults.map(u=>(
              <div key={u._id} className="search-result" onClick={()=>startConversation(u.username)}>
                <div className="conv-avatar">{getInitial(u.username)}{u.isOnline&&<span className="online-dot"/>}</div>
                <div><div style={{fontWeight:600,fontSize:'0.9rem'}}>@{u.username}</div><div style={{fontSize:'0.78rem',color:'var(--text-secondary)'}}>{u.about}</div></div>
              </div>
            ))}
          </div>
        )}
        <div className="conv-list">
          {convs.map(conv=>{
            const o=getOtherUser(conv);if(!o)return null;
            return(
              <div key={conv._id} className={`conv-item ${activeConv?.conversationId===conv.conversationId?'active':''}`} onClick={()=>selectConv(conv)}>
                <div className="conv-avatar">{o.avatar?<img src={o.avatar} alt=""/>:getInitial(o.username)}{o.isOnline&&<span className="online-dot"/>}</div>
                <div className="conv-info">
                  <div className="conv-name"><span>@{o.username}</span><span className="conv-time">{conv.lastMessage?formatTime(conv.lastMessage.createdAt):''}</span></div>
                  <div className="conv-preview">
                    {conv.lastMessage?(conv.lastMessage.type!=='text'?`📎 ${conv.lastMessage.type}`:conv.lastMessage.content?.substring(0,40)):'No messages yet'}
                    {conv.unreadCount>0&&<span className="unread-badge">{conv.unreadCount}</span>}
                  </div>
                </div>
              </div>
            );
          })}
          {convs.length===0&&<div style={{padding:'40px 20px',textAlign:'center',color:'var(--text-muted)',fontSize:'0.9rem'}}>No conversations yet.<br/>Click + to start chatting!</div>}
        </div>
      </div>

      {/* MAIN CHAT */}
      <div className={`chat-main ${showMobile==='sidebar'?'hidden':''}`}>
        {!activeConv?(
          <div className="chat-empty"><div className="logo">N://Chat</div><p>Select a conversation or start a new one</p></div>
        ):(
          <>
            <div className="chat-header">
              <div className="chat-header-info">
                <button className="icon-btn" onClick={()=>setShowMobile('sidebar')} style={{display:'none',marginRight:'4px'}}>←</button>
                <div className="conv-avatar" style={{width:40,height:40,fontSize:'0.95rem'}}>{otherUser?.avatar?<img src={otherUser.avatar} alt=""/>:getInitial(otherUser?.username)}{otherUser?.isOnline&&<span className="online-dot"/>}</div>
                <div className="chat-header-text">
                  <h3>@{otherUser?.username}</h3>
                  <div className={`chat-header-status ${typingUsers.length>0?'typing':otherUser?.isOnline?'online':''}`}>
                    {typingUsers.length>0?'typing...':otherUser?.isOnline?'online':`last seen ${formatLastSeen(otherUser?.lastSeen)}`}
                  </div>
                </div>
              </div>
              <div className="chat-header-actions">
                <button className="icon-btn" onClick={handleClearChat} title="Clear Messages">🧹</button>
                <button className="icon-btn" onClick={handleDeleteChat} title="Delete Chat" style={{color:'#ff4444'}}>🗑️</button>
                <button className="icon-btn" onClick={()=>startCall('voice')} title="Voice Call">📞</button>
                <button className="icon-btn" onClick={()=>startCall('video')} title="Video Call">📹</button>
              </div>
            </div>
            <div className="messages-container">
              {messages.map((msg,i)=>{
                const isSent=msg.sender?._id===user.id;
                const showDate=i===0||new Date(msg.createdAt).toDateString()!==new Date(messages[i-1]?.createdAt).toDateString();
                return(
                  <div key={msg._id}>
                    {showDate&&<div className="date-separator"><span>{new Date(msg.createdAt).toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'})}</span></div>}
                    <div className={`msg-row ${isSent?'sent':'received'} fade-in`}>
                      <div className="msg-bubble">
                        {renderMsgContent(msg)}
                        <div className="msg-meta">
                          {msg.type!=='deleted'&&<button onClick={()=>handleDeleteClick(msg)} style={{background:'none',border:'none',color:'var(--text-muted)',cursor:'pointer',fontSize:'0.7rem',marginRight:'4px'}} title="Delete Message">🗑️</button>}
                          <span className="msg-time">{formatTime(msg.createdAt)}</span>
                          {isSent&&renderTicks(msg.status)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {typingUsers.length>0&&<div className="typing-indicator">{typingUsers[0]?.username} is typing<span className="typing-dots"><span/><span/><span/></span></div>}
              <div ref={messagesEndRef}/>
            </div>
            <div className="chat-input-area" style={{position:'relative'}}>
              {showAttach&&(
                <div className="attach-menu">
                  <label className="attach-item"><span className="att-icon">🖼️</span>Image<input type="file" accept="image/*" hidden onChange={(e)=>handleFileUpload(e,'image')}/></label>
                  <label className="attach-item"><span className="att-icon">🎬</span>Video<input type="file" accept="video/*" hidden onChange={(e)=>handleFileUpload(e,'video')}/></label>
                  <label className="attach-item"><span className="att-icon">🎵</span>Audio<input type="file" accept="audio/*" hidden onChange={(e)=>handleFileUpload(e,'audio')}/></label>
                </div>
              )}
              {recording?(
                <div className="recording-bar">
                  <span className="recording-dot"/>
                  <span className="recording-time">{Math.floor(recordTime/60)}:{(recordTime%60).toString().padStart(2,'0')}</span>
                  <button className="recording-cancel" onClick={cancelRecording}>Cancel</button>
                  <button className="send-btn" onClick={stopRecording} style={{marginLeft:'auto'}}>⬆</button>
                </div>
              ):(
                <>
                  <div className="input-actions">
                    <button className="input-action-btn" onClick={()=>setShowAttach(!showAttach)}>📎</button>
                  </div>
                  <div className="chat-input-wrap">
                    <textarea rows={1} placeholder="Type a message..." value={msgInput} onChange={handleInputChange} onKeyDown={handleKeyDown}/>
                  </div>
                  {msgInput.trim()?<button className="send-btn" onClick={()=>sendMessage(msgInput)}>⬆</button>:<button className="send-btn" onClick={startRecording} style={{background:'var(--accent-orange)'}}>🎤</button>}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* CALL MODAL */}
      {callState&&(
        <div className="call-overlay">
          {callState.callType==='video'&&callState.type==='active'&&(
            <div className="call-videos"><video ref={remoteVideoRef} className="call-remote-video" autoPlay playsInline/><video ref={localVideoRef} className="call-local-video" autoPlay playsInline muted/></div>
          )}
          {callState.callType!=='video'||callState.type!=='active'?(
            <div className="call-info">
              <div className="call-avatar">{getInitial(callState.username)}</div>
              <h2>@{callState.username}</h2>
              <p>{callState.type==='incoming'?`Incoming ${callState.callType} call...`:callState.type==='outgoing'?'Calling...':callState.callType==='voice'?'Voice call':'Video call'}</p>
            </div>
          ):null}
          {callState.callType==='voice'&&callState.type==='active'&&(<><audio ref={remoteVideoRef} autoPlay/><video ref={localVideoRef} autoPlay playsInline muted style={{display:'none'}}/></>)}
          <div className="call-controls">
            {callState.type==='incoming'&&<button className="call-control-btn accept" onClick={acceptCall}>📞</button>}
            <button className={`call-control-btn ${isMuted?'muted':'mute'}`} onClick={toggleMute}>{isMuted?'🔇':'🔊'}</button>
            {callState.callType==='video'&&callState.type==='active'&&<button className={`call-control-btn ${isVideoOff?'muted':'mute'}`} onClick={toggleVideo}>{isVideoOff?'📷':'📹'}</button>}
            <button className="call-control-btn reject" onClick={callState.type==='incoming'?rejectCall:endCall}>✕</button>
          </div>
        </div>
      )}

      {/* SEARCH MODAL */}
      {showSearch&&!searchResults.length&&(
        <div className="modal-overlay" onClick={(e)=>{if(e.target===e.currentTarget){setShowSearch(false);setSearchQuery('');setSearchResults([])}}}>
          <div className="modal-card fade-in">
            <button className="modal-close" onClick={()=>{setShowSearch(false);setSearchQuery('');setSearchResults([])}}>✕</button>
            <h2>New Chat</h2>
            <div className="form-group"><input className="form-input" placeholder="Search by username..." value={searchQuery} onChange={(e)=>searchUsers(e.target.value)} autoFocus/></div>
            {searchResults.map(u=>(
              <div key={u._id} className="search-result" onClick={()=>startConversation(u.username)}>
                <div className="conv-avatar">{getInitial(u.username)}{u.isOnline&&<span className="online-dot"/>}</div>
                <div><div style={{fontWeight:600}}>@{u.username}</div><div style={{fontSize:'0.8rem',color:'var(--text-secondary)'}}>{u.about}</div></div>
              </div>
            ))}
            {searchQuery.length>=2&&searchResults.length===0&&<p style={{color:'var(--text-muted)',textAlign:'center',padding:'20px'}}>No users found</p>}
          </div>
        </div>
      )}
      {/* DELETE MODAL */}
      {deleteModalMsg&&(
        <div className="modal-overlay" onClick={()=>setDeleteModalMsg(null)}>
          <div className="modal-card fade-in" onClick={e=>e.stopPropagation()}>
            <h2 style={{marginBottom:'20px'}}>Delete message?</h2>
            <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
              {deleteModalMsg.sender?._id===user.id&&(
                <button 
                  onClick={()=>confirmDelete(true)}
                  style={{padding:'12px',background:'var(--accent)',color:'var(--bg)',border:'2px solid var(--border)',fontWeight:'bold',cursor:'pointer',boxShadow:'2px 2px 0 var(--border)'}}
                >
                  Delete for everyone
                </button>
              )}
              <button 
                onClick={()=>confirmDelete(false)}
                style={{padding:'12px',background:'var(--bg-card)',color:'var(--text)',border:'2px solid var(--border)',fontWeight:'bold',cursor:'pointer'}}
              >
                Delete for me
              </button>
              <button 
                onClick={()=>setDeleteModalMsg(null)}
                style={{padding:'12px',background:'transparent',color:'var(--text-muted)',border:'none',cursor:'pointer',marginTop:'8px',textDecoration:'underline'}}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
