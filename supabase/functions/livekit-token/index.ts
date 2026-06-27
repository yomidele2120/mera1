import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { AccessToken } from 'npm:livekit-server-sdk@2.9.7';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { roomName, participantName, participantIdentity } = await req.json();

    if (!roomName || !participantName || !participantIdentity) {
      return new Response(
        JSON.stringify({ error: 'roomName, participantName, and participantIdentity are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('LIVEKIT_API_KEY');
    const apiSecret = Deno.env.get('LIVEKIT_API_SECRET');

    if (!apiKey || !apiSecret) {
      return new Response(
        JSON.stringify({ error: 'LiveKit credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: String(participantIdentity),
      name: String(participantName),
      ttl: '4h',
    });

    at.addGrant({
      roomJoin: true,
      room: String(roomName),
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      canPublishSources: ['camera', 'microphone', 'screen_share', 'screen_share_audio'] as any,
    });

    const token = await at.toJwt();

    return new Response(JSON.stringify({ token }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('livekit-token error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? 'Failed to generate token' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
