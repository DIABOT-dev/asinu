export type ConsultationCallMode = "voice" | "video";

export function parseConsultationRoom(href: string) {
  try {
    const url = new URL(href);
    const roomName = url.pathname.match(/^\/([a-z\d_-]+)\/?$/i)?.[1];
    if (url.protocol !== "https:" || !roomName || url.username || url.password) {
      return null;
    }
    return { url, roomName };
  } catch {
    return null;
  }
}

export type ConsultationCall = NonNullable<ReturnType<typeof parseConsultationRoom>> & {
  mode: ConsultationCallMode;
};

export function consultationBrowserUrl({ url, mode }: ConsultationCall) {
  const options = new URLSearchParams(url.hash.slice(1));
  options.set("config.disableDeepLinking", "true");
  if (mode === "voice") {
    options.set("config.startAudioOnly", "true");
    options.set("config.startWithVideoMuted", "true");
  }
  return `${url.href.split("#", 1)[0]}#${options.toString()}`;
}

export function consultationCallHtml({ url, roomName, mode }: ConsultationCall, language: string) {
  const voiceOnly = mode === "voice";
  const options = JSON.stringify({
    roomName,
    jwt: url.searchParams.get("jwt") ?? undefined,
    lang: language,
    width: "100%",
    height: "100%",
    configOverwrite: {
      disableDeepLinking: true,
      prejoinConfig: { enabled: true },
      startAudioOnly: voiceOnly,
      startWithVideoMuted: voiceOnly,
    },
  }).replace(/</g, "\\u003c");

  return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-asinu-call' ${url.origin}; frame-src ${url.origin}; style-src 'unsafe-inline'; base-uri 'none';">
  <style>html, body, main { height: 100%; margin: 0; } iframe { display: block; border: 0; }</style>
</head>
<body>
  <main></main>
  <script src="${url.origin}/external_api.js"></script>
  <script nonce="asinu-call">
    const notify = (event) => window.ReactNativeWebView.postMessage(event);
    try {
      const api = new JitsiMeetExternalAPI(${JSON.stringify(url.host)}, {
        ...${options},
        parentNode: document.querySelector("main"),
        onload: () => notify("loaded")
      });
      api.addListener("readyToClose", () => {
        api.dispose();
        notify("closed");
      });
      window.endConsultationCall = () => api.executeCommand("hangup");
    } catch {
      notify("error");
    }
  </script>
</body>
</html>`;
}
