package dev.vertex.terminal

import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import dev.vertex.terminal.databinding.ActivitySetupBinding

class SetupActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val binding = ActivitySetupBinding.inflate(layoutInflater)
        setContentView(binding.root)
        val preferences = getSharedPreferences("vertex", Context.MODE_PRIVATE)
        val pairingUri = intent?.data
        if (pairingUri?.scheme == "vertex" && pairingUri.host == "pair") {
            binding.endpoint.setText(pairingUri.getQueryParameter("endpoint") ?: "")
            binding.token.setText(pairingUri.getQueryParameter("token") ?: "")
        }
        binding.endpoint.setText(preferences.getString("endpoint", ""))
        binding.token.setText(preferences.getString("token", ""))
        binding.save.setOnClickListener {
            preferences.edit()
                .putString("endpoint", binding.endpoint.text.toString().trim())
                .putString("token", binding.token.text.toString().trim())
                .apply()
            startActivity(Intent(this, SessionsActivity::class.java))
            finish()
        }
    }
}
