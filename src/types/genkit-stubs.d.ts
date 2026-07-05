// Stubs for dev-only GenKit modules removed in production
// These declarations silence TypeScript errors in builds where these packages are not installed.

declare module 'genkit' {
  const genkit: any;
  export default genkit;
}

declare module '@genkit-ai/google-genai' {
  const googleGenAI: any;
  export default googleGenAI;
}

declare module '@genkit-ai/next/client' {
  const genkitNextClient: any;
  export default genkitNextClient;
}
