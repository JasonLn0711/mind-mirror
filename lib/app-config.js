const DEFAULT_CONFIG = {
  demoMode: true,
  supabaseUrl: "",
  supabaseAnonKey: "",
  functionsUrl: "",
  appName: "Mind Mirror",
};

export function getAppConfig() {
  const provided = globalThis.window?.__QUIZ_APP_CONFIG__ || {};
  const config = {
    ...DEFAULT_CONFIG,
    ...provided,
  };

  const functionsUrl = config.functionsUrl || (config.supabaseUrl ? `${config.supabaseUrl}/functions/v1` : "");
  const remoteEnabled = Boolean(!config.demoMode && config.supabaseUrl && config.supabaseAnonKey);

  return {
    ...config,
    functionsUrl,
    remoteEnabled,
  };
}
