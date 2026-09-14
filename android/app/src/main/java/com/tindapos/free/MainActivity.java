package com.tindapos.free;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Registered before super.onCreate so the plugin is part of the initial bridge.
        registerPlugin(TindaUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
