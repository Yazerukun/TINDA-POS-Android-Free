package com.tindapos.free;

import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.content.pm.SigningInfo;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * ============================================================================
 * 🛡️ TINDA POS NATIVE INTEGRITY & ANTI-TAMPER SECURITY PLUGIN
 * ============================================================================
 * Doctoral Defense-in-Depth Ring:
 *  - Native APK Signature Pinning (Detects cracked / repacked / re-signed APKs)
 *  - Root & Superuser Binary Inspection
 *  - Runtime Environment & Package Fingerprint Integrity
 * ============================================================================
 */
@CapacitorPlugin(name = "TindaSecurity")
public class TindaSecurityPlugin extends Plugin {

    // Known authorized signature fingerprints (SHA-256 in uppercase hex without colons)
    // 1. Official Debug Keystore (for dev & continuous testing)
    // 2. Official Release Keystore (for production APK deployment)
    private static final String[] AUTHORIZED_SIGNATURE_SHA256 = new String[] {
        // Debug Keystore SHA-256: 93:62:72:B0:D1:70:11:C3:39:1E:71:DC:5A:46:DD:8E:8D:74:28:90:09:C2:29:02:83:1C:21:97:F9:04:42:33
        "936272B0D17011C3391E71DC5A46DD8E8D74289009C22902831C2197F9044233"
    };

    private static final String[] ROOT_PATHS = new String[] {
        "/system/app/Superuser.apk",
        "/sbin/su",
        "/system/bin/su",
        "/system/xbin/su",
        "/data/local/xbin/su",
        "/data/local/bin/su",
        "/system/sd/xbin/su",
        "/system/bin/failsafe/su",
        "/data/local/su"
    };

    @PluginMethod
    public void getAppIntegrity(PluginCall call) {
        try {
            Context context = getContext();
            PackageManager pm = context.getPackageManager();
            String packageName = context.getPackageName();

            List<String> certFingerprints = new ArrayList<>();
            boolean signatureValid = false;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                PackageInfo packageInfo = pm.getPackageInfo(packageName, PackageManager.GET_SIGNING_CERTIFICATES);
                SigningInfo signingInfo = packageInfo.signingInfo;
                if (signingInfo != null) {
                    Signature[] signatures = signingInfo.hasMultipleSigners()
                        ? signingInfo.getApkContentsSigners()
                        : signingInfo.getSigningCertificateHistory();

                    if (signatures != null) {
                        for (Signature sig : signatures) {
                            String sha256 = getSignatureSha256(sig);
                            if (sha256 != null) {
                                certFingerprints.add(sha256);
                                for (String auth : AUTHORIZED_SIGNATURE_SHA256) {
                                    if (auth.equalsIgnoreCase(sha256)) {
                                        signatureValid = true;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            } else {
                @SuppressWarnings("deprecation")
                PackageInfo packageInfo = pm.getPackageInfo(packageName, PackageManager.GET_SIGNATURES);
                if (packageInfo.signatures != null) {
                    for (Signature sig : packageInfo.signatures) {
                        String sha256 = getSignatureSha256(sig);
                        if (sha256 != null) {
                            certFingerprints.add(sha256);
                            for (String auth : AUTHORIZED_SIGNATURE_SHA256) {
                                if (auth.equalsIgnoreCase(sha256)) {
                                    signatureValid = true;
                                    break;
                                }
                            }
                        }
                    }
                }
            }

            boolean isRooted = checkRootState();
            boolean isDebuggable = (context.getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0;

            JSObject res = new JSObject();
            res.put("signatureValid", signatureValid);
            res.put("isRooted", isRooted);
            res.put("isDebuggable", isDebuggable);
            res.put("packageName", packageName);
            if (!certFingerprints.isEmpty()) {
                res.put("primaryCertificateSha256", certFingerprints.get(0));
            }
            res.put("tamperDetected", !signatureValid && !isDebuggable);

            call.resolve(res);
        } catch (Exception e) {
            call.reject("Security integrity check error: " + e.getMessage());
        }
    }

    private static String getSignatureSha256(Signature signature) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(signature.toByteArray());
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) {
                sb.append(String.format(Locale.US, "%02X", b));
            }
            return sb.toString();
        } catch (Exception e) {
            return null;
        }
    }

    private static boolean checkRootState() {
        try {
            String buildTags = Build.TAGS;
            if (buildTags != null && buildTags.contains("test-keys")) {
                return true;
            }
            for (String path : ROOT_PATHS) {
                if (new File(path).exists()) {
                    return true;
                }
            }
        } catch (Exception ignored) {}
        return false;
    }
}
