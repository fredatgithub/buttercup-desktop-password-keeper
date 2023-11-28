import { app } from "electron";
import { initialize as initialiseElectronRemote } from "@electron/remote/main";
import "./ipc";
import { initialise } from "./services/init";
import { openMainWindow } from "./services/windows";
import { handleProtocolCall } from "./services/protocol";
import { shouldShowMainWindow } from "./services/arguments";
import { logErr, logInfo } from "./library/log";
import { BUTTERCUP_PROTOCOL, PLATFORM_MACOS } from "./symbols";
import { getStartInBackground } from "./services/config";

logInfo("Application starting");

const lock = app.requestSingleInstanceLock();
if (!lock) {
    app.quit();
}

// app.on("window-all-closed", () => {
//   if (process.platform !== PLATFORM_MACOS) {
//       app.quit();
//   }
// });

app.on("window-all-closed", (event: Event) => {
    event.preventDefault();
});

app.on("activate", () => {
    openMainWindow();
});

// **
// ** App protocol handling
// **

app.on("second-instance", async (event, args) => {
    await openMainWindow();
    // Protocol URL for Linux/Windows
    const protocolURL = args.find((arg) => arg.startsWith(BUTTERCUP_PROTOCOL));
    if (protocolURL) {
        handleProtocolCall(protocolURL);
    }
});
app.on("open-url", (e, url) => {
    // Protocol URL for MacOS
    if (url.startsWith(BUTTERCUP_PROTOCOL)) {
        handleProtocolCall(url);
    }
});

// **
// ** Boot
// **

app.whenReady()
    .then(() => {
        logInfo("Application ready");
        initialiseElectronRemote();
    })
    .then(() => initialise())
    .then(() => {
        const protocol = BUTTERCUP_PROTOCOL.replace("://", "");
        if (!app.isDefaultProtocolClient(protocol)) {
            logInfo(`Registering protocol: ${protocol}`);
            const protoReg = app.setAsDefaultProtocolClient(protocol);
            if (!protoReg) {
                logErr(`Failed registering protocol: ${protocol}`);
            }
        } else {
            logInfo(`Protocol already registered: ${protocol}`);
        }
    })
    .then(async () => {
        const hideInTray = await getStartInBackground();
        if (!shouldShowMainWindow() || hideInTray) {
            logInfo("Opening initial window disabled by CL or preferences");
            return;
        }
        openMainWindow();
    })
    .catch((err) => {
        logErr(err);
        app.quit();
    });
