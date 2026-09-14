package com.tindapos.free;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Android half of the TINDA POS Free in-app updater.
 *
 * The WebView cannot download a GitHub release asset (those responses carry no
 * CORS headers) and it cannot start the package installer, so both steps live
 * here: download the official APK into the app cache and hand it to Android.
 */
@CapacitorPlugin(name = "TindaUpdater")
public class TindaUpdaterPlugin extends Plugin {

    private static final String UPDATES_DIR = "updates";
    private static final String APK_MIME = "application/vnd.android.package-archive";
    private static final String FALLBACK_APK_NAME = "tinda-pos-free-update.apk";
    private static final int CONNECT_TIMEOUT_MS = 20000;
    private static final int READ_TIMEOUT_MS = 120000;
    private static final int BUFFER_BYTES = 64 * 1024;
    private static final int PROGRESS_STEP_BYTES = 128 * 1024;

    private final ExecutorService worker = Executors.newSingleThreadExecutor();

    /** Installed version, straight from the package manager (never guessed in JS). */
    @PluginMethod
    public void getVersion(PluginCall call) {
        try {
            Context context = getContext();
            PackageInfo info = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
            JSObject result = new JSObject();
            result.put("versionName", info.versionName == null ? "" : info.versionName);
            result.put("versionCode", Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? info.getLongVersionCode() : info.versionCode);
            result.put("packageName", context.getPackageName());
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Unable to read the installed app version: " + error.getMessage());
        }
    }

    /** Whether Android will let this app request an install right now. */
    @PluginMethod
    public void canInstall(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", canRequestPackageInstalls());
        call.resolve(result);
    }

    /** Opens the system screen where the user allows installs from this app. */
    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        try {
            Context context = getContext();
            Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
            intent.setData(Uri.parse("package:" + context.getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("Unable to open the install permission screen: " + error.getMessage());
        }
    }

    /** Downloads the release APK into the app cache and reports progress events. */
    @PluginMethod
    public void download(final PluginCall call) {
        final String url = call.getString("url");
        if (url == null || !url.startsWith("https://")) {
            call.reject("A secure (https) update URL is required.");
            return;
        }
        final String fileName = safeFileName(call.getString("fileName"));
        final Context context = getContext().getApplicationContext();

        worker.execute(() -> {
            HttpURLConnection connection = null;
            FileOutputStream out = null;
            try {
                File target = updateFile(context, fileName);
                connection = (HttpURLConnection) new URL(url).openConnection();
                connection.setInstanceFollowRedirects(true);
                connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
                connection.setReadTimeout(READ_TIMEOUT_MS);
                connection.setRequestProperty("Accept", "application/octet-stream");
                connection.setRequestProperty("User-Agent", "TINDA-POS-Free-Updater");

                int status = connection.getResponseCode();
                if (status < 200 || status >= 300) {
                    call.reject("Download failed: HTTP " + status);
                    return;
                }

                long total = connection.getContentLengthLong();
                InputStream in = connection.getInputStream();
                out = new FileOutputStream(target, false);
                byte[] buffer = new byte[BUFFER_BYTES];
                long downloaded = 0;
                long nextProgressAt = 0;
                int read;
                while ((read = in.read(buffer)) != -1) {
                    out.write(buffer, 0, read);
                    downloaded += read;
                    if (downloaded >= nextProgressAt) {
                        emitProgress(downloaded, total);
                        nextProgressAt = downloaded + PROGRESS_STEP_BYTES;
                    }
                }
                out.flush();
                out.close();
                out = null;
                in.close();

                if (target.length() <= 0) {
                    call.reject("Downloaded update file is empty.");
                    return;
                }

                emitProgress(downloaded, total > 0 ? total : downloaded);
                JSObject result = new JSObject();
                result.put("fileName", fileName);
                result.put("path", target.getAbsolutePath());
                result.put("bytes", target.length());
                call.resolve(result);
            } catch (Exception error) {
                call.reject("Download failed: " + error.getMessage());
            } finally {
                if (out != null) {
                    try {
                        out.close();
                    } catch (Exception ignored) {
                        // nothing useful to do while closing
                    }
                }
                if (connection != null) {
                    connection.disconnect();
                }
            }
        });
    }

    /** Hands the downloaded APK to the Android package installer. */
    @PluginMethod
    public void install(PluginCall call) {
        String requested = call.getString("fileName");
        if (requested == null || requested.isEmpty()) {
            call.reject("An update file name is required.");
            return;
        }

        File apk = updateFile(getContext().getApplicationContext(), safeFileName(requested));
        if (!apk.isFile() || apk.length() <= 0) {
            call.reject("The downloaded update file is missing. Download it again.");
            return;
        }

        JSObject result = new JSObject();
        if (!canRequestPackageInstalls()) {
            result.put("launched", false);
            result.put("needsPermission", true);
            call.resolve(result);
            return;
        }

        try {
            Context context = getContext();
            Uri uri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", apk);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, APK_MIME);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            result.put("launched", true);
            result.put("needsPermission", false);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Android could not open the installer: " + error.getMessage());
        }
    }

    private boolean canRequestPackageInstalls() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return true;
        }
        return getContext().getPackageManager().canRequestPackageInstalls();
    }

    private File updateFile(Context context, String fileName) {
        File dir = new File(context.getCacheDir(), UPDATES_DIR);
        if (!dir.exists()) {
            dir.mkdirs();
        }
        return new File(dir, fileName);
    }

    /** Keeps the asset name but never lets it escape the cache directory. */
    private String safeFileName(String requested) {
        if (requested == null || requested.trim().isEmpty()) {
            return FALLBACK_APK_NAME;
        }
        String cleaned = requested.trim().replaceAll("[^A-Za-z0-9._-]", "_");
        if (cleaned.isEmpty()) {
            cleaned = FALLBACK_APK_NAME;
        }
        if (!cleaned.toLowerCase(Locale.US).endsWith(".apk")) {
            cleaned = cleaned + ".apk";
        }
        return cleaned;
    }

    private void emitProgress(final long downloaded, final long total) {
        final long safeTotal = total > 0 ? total : downloaded;
        final JSObject payload = new JSObject();
        payload.put("downloaded", downloaded);
        payload.put("total", safeTotal);
        payload.put("percent", safeTotal > 0 ? Math.min(100, Math.round((downloaded * 100.0) / safeTotal)) : 0);

        Activity activity = getActivity();
        if (activity != null) {
            activity.runOnUiThread(() -> notifyListeners("progress", payload));
        } else {
            notifyListeners("progress", payload);
        }
    }
}
