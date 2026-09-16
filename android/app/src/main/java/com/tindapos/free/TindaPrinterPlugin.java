package com.tindapos.free;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.Settings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.core.app.ActivityCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONException;

/**
 * Native Android printing plugin for TINDA POS Free.
 * Supports:
 * 1. Bluetooth Thermal Receipt Printers (58mm / 80mm ESC/POS) via standard SPP RFCOMM.
 * 2. Android System Print (WiFi, Mopria, Save as PDF) via PrintManager.
 * 3. Receipt sharing via Android Share intent.
 */
@CapacitorPlugin(
    name = "TindaPrinter",
    permissions = {
        @Permission(
            strings = { Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_SCAN },
            alias = "bluetooth"
        )
    }
)
public class TindaPrinterPlugin extends Plugin {

    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private static final String SYSTEM_PRINT_NAME = "SYSTEM_PRINT";

    private final ExecutorService worker = Executors.newSingleThreadExecutor();

    // Regular expressions to recognise receipt structures for clean ESC/POS layout
    private static final Pattern MONEY_LINE = Pattern.compile("^(Subtotal|Discounts?|TOTAL|Cash|SUKLI|Gross Sales|Refunds|Cash Refunds|Voids|NET SALES|GCash|Maya|Utang|Expenses|Expected Cash|Actual Cash|Difference|Starting Cash|Cash In|Cash Out)\\s+(-?\\d[\\d,]*(?:\\.\\d+)?)$", Pattern.CASE_INSENSITIVE);
    private static final Pattern ITEM_DETAIL = Pattern.compile("^(\\d+(?:\\.\\d+)?)\\s+x\\s+(\\d+(?:\\.\\d+)?)\\s+(\\d+(?:\\.\\d+)?)$");

    /**
     * Lists available printer targets:
     * - Android System Print (always present)
     * - Paired Bluetooth Devices (if Bluetooth is enabled and permitted)
     */
    @PluginMethod
    public void listPrinters(PluginCall call) {
        JSArray printers = new JSArray();

        // 1. Android System Print option
        JSObject systemOption = new JSObject();
        systemOption.put("name", SYSTEM_PRINT_NAME);
        systemOption.put("displayName", "Android System Print (WiFi, Mopria, Save as PDF)");
        systemOption.put("isDefault", true);
        printers.put(systemOption);

        boolean btAvailable = false;
        boolean btEnabled = false;
        boolean hasPermission = hasBluetoothPermission();

        try {
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter != null) {
                btAvailable = true;
                btEnabled = adapter.isEnabled();

                if (btEnabled && hasPermission) {
                    Set<BluetoothDevice> pairedDevices = adapter.getBondedDevices();
                    if (pairedDevices != null) {
                        for (BluetoothDevice device : pairedDevices) {
                            String name = device.getName();
                            String address = device.getAddress();
                            JSObject btOption = new JSObject();
                            btOption.put("name", "BT:" + address);
                            btOption.put("displayName", "Bluetooth: " + (name != null && !name.isEmpty() ? name : "Thermal Printer") + " (" + address + ")");
                            btOption.put("isDefault", false);
                            printers.put(btOption);
                        }
                    }
                }
            }
        } catch (SecurityException se) {
            hasPermission = false;
        } catch (Exception ignored) {
        }

        JSObject result = new JSObject();
        result.put("printers", printers);
        result.put("bluetoothAvailable", btAvailable);
        result.put("bluetoothEnabled", btEnabled);
        result.put("hasBluetoothPermission", hasPermission);
        call.resolve(result);
    }

    /**
     * Checks whether Bluetooth permissions are granted.
     */
    private boolean hasBluetoothPermission() {
        Context context = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return ActivityCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
        } else {
            return ActivityCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH) == PackageManager.PERMISSION_GRANTED;
        }
    }

    /**
     * Requests Bluetooth permissions on Android 12+.
     */
    @PluginMethod
    public void requestBluetoothPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (!hasBluetoothPermission()) {
                requestPermissionForAlias("bluetooth", call, "bluetoothPermissionCallback");
                return;
            }
        }
        JSObject res = new JSObject();
        res.put("granted", true);
        call.resolve(res);
    }

    /**
     * Callback for permission request.
     */
    @SuppressWarnings("unused")
    protected void bluetoothPermissionCallback(PluginCall call) {
        JSObject res = new JSObject();
        res.put("granted", hasBluetoothPermission());
        call.resolve(res);
    }

    /**
     * Prints a receipt through either Android System Print or Bluetooth ESC/POS.
     */
    @PluginMethod
    public void printReceipt(PluginCall call) {
        String printerName = call.getString("printerName", SYSTEM_PRINT_NAME);
        if (printerName == null || printerName.trim().isEmpty()) {
            printerName = SYSTEM_PRINT_NAME;
        }

        JSArray linesArray = call.getArray("lines");
        List<String> lines = new ArrayList<>();
        if (linesArray != null) {
            for (int i = 0; i < linesArray.length(); i++) {
                try {
                    lines.add(linesArray.getString(i));
                } catch (JSONException ignored) {
                }
            }
        }

        String paperWidth = call.getString("paperWidth", "58mm");
        int copies = call.getInt("copies", 1);
        String rawHtml = call.getString("rawHtml", "");
        String title = call.getString("title", "Receipt");

        if (SYSTEM_PRINT_NAME.equalsIgnoreCase(printerName)) {
            printViaSystem(rawHtml, title, call);
        } else if (printerName.startsWith("BT:")) {
            String mac = printerName.substring(3).trim();
            worker.execute(() -> printViaBluetooth(mac, lines, paperWidth, copies, call));
        } else {
            // Unknown printer name format — fallback to system print
            printViaSystem(rawHtml, title, call);
        }
    }

    /**
     * Android System Print via PrintManager.
     */
    private void printViaSystem(String html, String title, PluginCall call) {
        if (html == null || html.trim().isEmpty()) {
            call.reject("Cannot print via system: HTML content is empty");
            return;
        }

        getActivity().runOnUiThread(() -> {
            try {
                WebView printWebView = new WebView(getContext());
                printWebView.setWebViewClient(new WebViewClient() {
                    private boolean printed = false;

                    @Override
                    public void onPageFinished(WebView view, String url) {
                        if (printed) return;
                        printed = true;

                        try {
                            PrintManager printManager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                            String jobName = "TINDA POS - " + (title != null && !title.isEmpty() ? title : "Receipt");
                            PrintDocumentAdapter printAdapter = printWebView.createPrintDocumentAdapter(jobName);
                            printManager.print(jobName, printAdapter, new PrintAttributes.Builder().build());

                            JSObject result = new JSObject();
                            result.put("ok", true);
                            result.put("code", "PRINTED");
                            result.put("message", "Android system print dialog opened.");
                            call.resolve(result);
                        } catch (Exception e) {
                            JSObject result = new JSObject();
                            result.put("ok", false);
                            result.put("code", "FAILED");
                            result.put("message", "PrintManager error: " + e.getMessage());
                            call.resolve(result);
                        }
                    }
                });

                printWebView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
            } catch (Exception e) {
                JSObject result = new JSObject();
                result.put("ok", false);
                result.put("code", "FAILED");
                result.put("message", "Failed to initialize print WebView: " + e.getMessage());
                call.resolve(result);
            }
        });
    }

    /**
     * Direct Bluetooth ESC/POS printing.
     */
    private void printViaBluetooth(String macAddress, List<String> lines, String paperWidth, int copies, PluginCall call) {
        if (!hasBluetoothPermission()) {
            JSObject err = new JSObject();
            err.put("ok", false);
            err.put("code", "UNAVAILABLE");
            err.put("message", "Bluetooth permission not granted. Please allow Nearby Devices permission in App Settings.");
            call.resolve(err);
            return;
        }

        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null || !adapter.isEnabled()) {
            JSObject err = new JSObject();
            err.put("ok", false);
            err.put("code", "UNAVAILABLE");
            err.put("message", "Bluetooth is turned off on this device.");
            call.resolve(err);
            return;
        }

        BluetoothDevice device;
        try {
            device = adapter.getRemoteDevice(macAddress);
        } catch (IllegalArgumentException iae) {
            JSObject err = new JSObject();
            err.put("ok", false);
            err.put("code", "UNAVAILABLE");
            err.put("message", "Invalid Bluetooth printer address: " + macAddress);
            call.resolve(err);
            return;
        }

        BluetoothSocket socket = null;
        try {
            // Cancel discovery to avoid slow connection
            try {
                adapter.cancelDiscovery();
            } catch (SecurityException ignored) {
            }

            // Connect using standard SPP UUID
            try {
                socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
                socket.connect();
            } catch (IOException ex) {
                // Fallback using reflection for stubborn thermal printers
                try {
                    Method m = device.getClass().getMethod("createRfcommSocket", int.class);
                    socket = (BluetoothSocket) m.invoke(device, 1);
                    if (socket != null) {
                        socket.connect();
                    } else {
                        throw ex;
                    }
                } catch (Exception fallbackEx) {
                    throw ex;
                }
            }

            OutputStream out = socket.getOutputStream();

            // Build ESC/POS bytes
            byte[] escPosPayload = buildEscPosPayload(lines, paperWidth);

            int copyCount = Math.max(1, Math.min(copies, 5));
            for (int c = 0; c < copyCount; c++) {
                out.write(escPosPayload);
                out.flush();
                if (copyCount > 1 && c < copyCount - 1) {
                    try {
                        Thread.sleep(800);
                    } catch (InterruptedException ignored) {
                    }
                }
            }

            JSObject res = new JSObject();
            res.put("ok", true);
            res.put("code", "PRINTED");
            res.put("message", "Receipt printed successfully via Bluetooth.");
            call.resolve(res);

        } catch (Exception error) {
            JSObject err = new JSObject();
            err.put("ok", false);
            err.put("code", "FAILED");
            err.put("message", "Failed to print to Bluetooth device: " + error.getMessage() + ". Check if printer is ON and paired.");
            call.resolve(err);
        } finally {
            if (socket != null) {
                try {
                    socket.close();
                } catch (IOException ignored) {
                }
            }
        }
    }

    /**
     * Generates standard ESC/POS byte sequence from receipt lines.
     */
    private byte[] buildEscPosPayload(List<String> lines, String paperWidth) throws IOException {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        int maxCols = "80mm".equalsIgnoreCase(paperWidth) ? 48 : 32;

        // ESC @: Initialize printer
        buffer.write(new byte[]{0x1B, 0x40});
        // Select standard character table
        buffer.write(new byte[]{0x1B, 0x74, 0x00});

        boolean seenSeparator = false;

        for (int i = 0; i < lines.size(); i++) {
            String raw = lines.get(i);
            if (raw == null) continue;
            String trimmed = raw.trim();

            // Check separator line (e.g. "--------------------------------")
            if (trimmed.length() >= 3 && trimmed.matches("^-+$")) {
                seenSeparator = true;
                writeAlignedLine(buffer, makeDashes(maxCols), 0, false, false);
                continue;
            }

            // Top Header block before first separator: Store name + Address + Contact
            if (!seenSeparator) {
                if (i == 0) {
                    // Store Name: Centered, Double-width + Double-height, Bold
                    writeAlignedLine(buffer, cleanText(trimmed), 1, true, true);
                } else {
                    // Header sub-details: Centered, Normal, Not Bold
                    writeAlignedLine(buffer, cleanText(trimmed), 1, false, false);
                }
                continue;
            }

            // Detail lines inside body
            // Check if Item Detail ("qty x unit_price   amount")
            Matcher detailMatcher = ITEM_DETAIL.matcher(trimmed);
            if (detailMatcher.matches()) {
                // Already consumed by previous item name row, but handle standalone if encountered
                String left = detailMatcher.group(1) + " x " + detailMatcher.group(2);
                String right = detailMatcher.group(3);
                writeTwoColumns(buffer, left, right, maxCols, false);
                continue;
            }

            // Check if next row is Item Detail
            if (i + 1 < lines.size()) {
                String nextLine = lines.get(i + 1);
                if (nextLine != null) {
                    Matcher nextMatcher = ITEM_DETAIL.matcher(nextLine.trim());
                    if (nextMatcher.matches()) {
                        // Current line is Product Name: Left aligned, Bold
                        writeAlignedLine(buffer, cleanText(trimmed), 0, false, true);
                        // Next line is Qty x Price and Subtotal
                        String left = "  " + nextMatcher.group(1) + " x " + nextMatcher.group(2);
                        String right = nextMatcher.group(3);
                        writeTwoColumns(buffer, left, right, maxCols, false);
                        i++; // Skip the next line as it was rendered
                        continue;
                    }
                }
            }

            // Check if Money Line (Subtotal, TOTAL, Cash, SUKLI, Utang, etc.)
            Matcher moneyMatcher = MONEY_LINE.matcher(trimmed);
            if (moneyMatcher.matches()) {
                String label = moneyMatcher.group(1);
                String amt = moneyMatcher.group(2);
                boolean isMajor = "TOTAL".equalsIgnoreCase(label) || "SUKLI".equalsIgnoreCase(label) || "NET SALES".equalsIgnoreCase(label);
                String displayLabel = "SUKLI".equalsIgnoreCase(label) ? "Change / SUKLI" : label;
                writeTwoColumns(buffer, displayLabel, "PHP " + amt, maxCols, isMajor);
                continue;
            }

            // Empty line / gap
            if (trimmed.isEmpty()) {
                buffer.write("\n".getBytes(StandardCharsets.US_ASCII));
                continue;
            }

            // Normal text row (e.g. No: ..., Date: ..., Cashier: ..., Footer)
            // If footer or end message, center it
            if (trimmed.startsWith("Items:") || trimmed.startsWith("No:") || trimmed.startsWith("Date:") || trimmed.startsWith("Cashier:") || trimmed.startsWith("Customer:")) {
                writeAlignedLine(buffer, cleanText(trimmed), 0, false, false);
            } else {
                // Center footer lines
                writeAlignedLine(buffer, cleanText(trimmed), 1, false, false);
            }
        }

        // Feed 4 lines for tear-off
        buffer.write(new byte[]{0x1B, 0x64, 0x04});
        // GS V 66 0: Partial cut if supported
        buffer.write(new byte[]{0x1D, 0x56, 0x42, 0x00});

        return buffer.toByteArray();
    }

    private void writeAlignedLine(ByteArrayOutputStream buffer, String text, int align, boolean doubleSize, boolean bold) throws IOException {
        // Alignment: 0 = Left, 1 = Center, 2 = Right
        buffer.write(new byte[]{0x1B, 0x61, (byte) align});
        // Size
        buffer.write(new byte[]{0x1D, 0x21, doubleSize ? (byte) 0x11 : (byte) 0x00});
        // Bold
        buffer.write(new byte[]{0x1B, 0x45, bold ? (byte) 0x01 : (byte) 0x00});

        buffer.write(text.getBytes(StandardCharsets.US_ASCII));
        buffer.write("\n".getBytes(StandardCharsets.US_ASCII));

        // Reset
        if (doubleSize) buffer.write(new byte[]{0x1D, 0x21, 0x00});
        if (bold) buffer.write(new byte[]{0x1B, 0x45, 0x00});
    }

    private void writeTwoColumns(ByteArrayOutputStream buffer, String left, String right, int maxCols, boolean bold) throws IOException {
        buffer.write(new byte[]{0x1B, 0x61, 0x00}); // Left align
        buffer.write(new byte[]{0x1D, 0x21, 0x00}); // Normal size
        buffer.write(new byte[]{0x1B, 0x45, bold ? (byte) 0x01 : (byte) 0x00});

        String cleanLeft = cleanText(left);
        String cleanRight = cleanText(right);

        int spacesNeeded = maxCols - (cleanLeft.length() + cleanRight.length());
        StringBuilder line = new StringBuilder();
        line.append(cleanLeft);
        if (spacesNeeded > 0) {
            for (int s = 0; s < spacesNeeded; s++) line.append(' ');
        } else {
            line.append(' ');
        }
        line.append(cleanRight);

        buffer.write(line.toString().getBytes(StandardCharsets.US_ASCII));
        buffer.write("\n".getBytes(StandardCharsets.US_ASCII));

        if (bold) buffer.write(new byte[]{0x1B, 0x45, 0x00});
    }

    private String makeDashes(int length) {
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) sb.append('-');
        return sb.toString();
    }

    /**
     * Cleans unicode characters that cause thermal printer corruption (e.g. ₱ -> PHP).
     */
    private String cleanText(String input) {
        if (input == null) return "";
        return input.replace("₱", "PHP ")
                    .replace("’", "'")
                    .replace("“", "\"")
                    .replace("”", "\"")
                    .replaceAll("[^\\x20-\\x7E]", " ");
    }

    /**
     * Share plain text receipt via Android system share dialog.
     */
    @PluginMethod
    public void shareReceipt(PluginCall call) {
        String text = call.getString("text", "");
        String title = call.getString("title", "Receipt");

        if (text == null || text.trim().isEmpty()) {
            call.reject("Cannot share: empty receipt content");
            return;
        }

        Intent sendIntent = new Intent();
        sendIntent.setAction(Intent.ACTION_SEND);
        sendIntent.putExtra(Intent.EXTRA_TEXT, text);
        sendIntent.putExtra(Intent.EXTRA_TITLE, title);
        sendIntent.setType("text/plain");

        Intent shareIntent = Intent.createChooser(sendIntent, title);
        shareIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(shareIntent);

        JSObject res = new JSObject();
        res.put("ok", true);
        call.resolve(res);
    }

    /**
     * Opens Android Bluetooth Settings so user can easily pair a new thermal printer.
     */
    @PluginMethod
    public void openBluetoothSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject res = new JSObject();
            res.put("ok", true);
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Failed to open Bluetooth settings: " + e.getMessage());
        }
    }
}
