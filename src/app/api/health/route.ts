export function GET() {
  return Response.json(
    { status: 'ok', service: 'adhara-web' },
    {
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
