package dev.vertex.terminal

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.ViewGroup
import android.widget.Button
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.biometric.BiometricPrompt
import androidx.biometric.BiometricManager
import androidx.core.content.ContextCompat
import dev.vertex.terminal.databinding.ActivitySessionsBinding

class SessionsActivity : AppCompatActivity() {
    private lateinit var binding: ActivitySessionsBinding
    private lateinit var client: VertexClient
    private var unlocked = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val preferences = getSharedPreferences("vertex", Context.MODE_PRIVATE)
        val endpoint = preferences.getString("endpoint", "") ?: ""
        val token = preferences.getString("token", "") ?: ""
        if (endpoint.isBlank() || token.isBlank()) {
            startActivity(Intent(this, SetupActivity::class.java)); finish(); return
        }
        client = VertexClient(endpoint, token)
        binding = ActivitySessionsBinding.inflate(layoutInflater)
        setContentView(binding.root)
        binding.settings.setOnClickListener { startActivity(Intent(this, SetupActivity::class.java)) }
        binding.newSession.setOnClickListener { createSession() }
        requestUnlock()
    }

    override fun onResume() { super.onResume(); if (::client.isInitialized && unlocked) loadSessions() }

    private fun requestUnlock() {
        if (BiometricManager.from(this).canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL) != BiometricManager.BIOMETRIC_SUCCESS) {
            unlocked = true; loadSessions(); return
        }
        val prompt = BiometricPrompt(this, ContextCompat.getMainExecutor(this), object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) { super.onAuthenticationSucceeded(result); unlocked = true; loadSessions() }
            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) { binding.status.text = "Unlock Vertex to connect" }
        })
        prompt.authenticate(BiometricPrompt.PromptInfo.Builder().setTitle("Unlock Vertex").setSubtitle("Access your laptop terminal").setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL).build())
    }

    private fun loadSessions() {
        binding.status.text = "Connecting…"
        client.sessions { result -> runOnUiThread {
            result.onSuccess { sessions ->
                binding.status.text = "Laptop online"
                binding.sessionList.removeAllViews()
                for (index in 0 until sessions.length()) {
                    val session = sessions.getJSONObject(index)
                    Button(this).apply {
                        text = session.getString("name")
                        setOnClickListener { openTerminal(session.getString("name")) }
                        binding.sessionList.addView(this, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
                    }
                }
            }.onFailure { binding.status.text = "Laptop unavailable: ${it.message}" }
        }}
    }

    private fun createSession() {
        val view = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            setPadding(48, 8, 48, 8)
        }
        val name = android.widget.EditText(this)
        val folder = android.widget.EditText(this)
        name.hint = "Session name (for example, vertex)"
        folder.hint = "Project folder (for example, /home/me/vertex)"
        name.isSingleLine = true; folder.isSingleLine = true
        view.addView(name); view.addView(folder)
        AlertDialog.Builder(this).setTitle("New terminal session").setView(view)
            .setPositiveButton("Create") { _, _ ->
                // Creation is sent over the socket so this remains the only mutation protocol.
                openTerminal(name.text.toString().trim(), folder.text.toString().trim())
            }.setNegativeButton("Cancel", null).show()
    }

    private fun openTerminal(name: String, cwd: String? = null) {
        startActivity(Intent(this, TerminalActivity::class.java).putExtra("name", name).putExtra("cwd", cwd))
    }
}
