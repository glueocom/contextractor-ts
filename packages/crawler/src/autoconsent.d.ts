// TODO: remove when @duckduckgo/autoconsent ships official TypeScript declarations
declare module '@duckduckgo/autoconsent' {
  type AutoconsentCtor = new (
    sendMessage: (message: unknown) => void,
    options: {
      enabled: boolean;
      autoAction: 'optOut';
      enableCosmeticRules: boolean;
      detectRetries: number;
    },
    rules: unknown,
  ) => {
    receiveMessageCallback(message: unknown): void;
  };

  const AutoConsent: AutoconsentCtor;
  export default AutoConsent;
}
