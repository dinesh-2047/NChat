import { NextResponse } from 'next/server';
import cloudinary from '@/lib/cloudinary';
import { getAuthUser } from '@/lib/auth';

export async function POST(request) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const type = formData.get('type') || 'image'; // image, video, audio, file

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Convert file to buffer then to base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');
    const dataUri = `data:${file.type};base64,${base64}`;

    // Determine resource type for Cloudinary
    let resourceType = 'auto';
    if (type === 'audio') resourceType = 'video'; // Cloudinary treats audio as video
    if (type === 'video') resourceType = 'video';
    if (type === 'image') resourceType = 'image';

    const result = await cloudinary.uploader.upload(dataUri, {
      resource_type: resourceType,
      folder: `nchat/${type}s`,
      quality: 'auto',
      fetch_format: 'auto',
    });

    return NextResponse.json({
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      size: result.bytes,
      duration: result.duration || 0,
      width: result.width,
      height: result.height,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
