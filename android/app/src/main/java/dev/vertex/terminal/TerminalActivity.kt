package dev.vertex.terminal

import android.content.Context
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.appcompat.app.AppCompatActivity
import dev.vertex.terminal.databinding.ActivityTerminalBinding
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject

class TerminalActivity : AppCompatActivity() {
    private lateinit var binding: ActivityTerminalBinding
    private lateinit var socket: WebSocket
    private val sessionName by lazy { intent.getStringExtra("name") ?: "terminal" }
    private val cwd by lazy { intent.getStringExtra("cwd") }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityTerminalBinding.inflate(layoutInflater)
        setContentView(binding.root)
        binding.sessionName.text = sessionName
        binding.terminal.settings.javaScriptEnabled = true
        binding.terminal.settings.domStorageEnabled = true
        binding.terminal.addJavascriptInterface(Bridge(), "Vertex")
        binding.terminal.loadUrl("file:///android_asset/terminal.html")
        listOf("Ctrl" to "\u0003", "Esc" to "\u001b", "Tab" to "\t", "↑" to "\u001b[A", "↓" to "\u001b[B", "←" to "\u001b[D", "→" to "\u001b[C").forEach { (label, data) ->
            android.widget.Button(this).apply { text = label; setOnClickListener { sendInput(data) }; binding.keyRow.addView(this) }
        }
        val preferences = getSharedPreferences("vertex", Context.MODE_PRIVATE)
        val client = VertexClient(preferences.getString("endpoint", "")!!, preferences.getString("token", "")!!)
        socket = client.socket(object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) { }
            override fun onMessage(webSocket: WebSocket, text: String) {
                val event = JSONObject(text)
                when (event.getString("type")) {
                    "ready" -> if (cwd.isNullOrBlank()) attach() else create()
                    "created" -> attach()
                    "output" -> terminalOutput(event.getString("data"))
                    "error" -> terminalStatus(event.getString("message"))
                    "closed" -> terminalStatus("Session detached")
                }
            }
            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) = terminalStatus("Disconnected: ${t.message}")
        })
    }

    private fun create() = socket.send(JSONObject(mapOf("type" to "create", "name" to sessionName, "cwd" to cwd)).toString())
    private fun attach() = socket.send(JSONObject(mapOf("type" to "attach", "name" to sessionName)).toString())
    private fun sendInput(data: String) { if (::socket.isInitialized) socket.send(JSONObject(mapOf("type" to "input", "data" to data)).toString()) }
    private fun terminalOutput(data: String) = binding.terminal.post { binding.terminal.evaluateJavascript("window.vertexOutput(${JSONObject.quote(data)})", null) }
    private fun terminalStatus(data: String) = binding.terminal.post { binding.terminal.evaluateJavascript("window.vertexStatus(${JSONObject.quote(data)})", null) }
    override fun onDestroy() { if (::socket.isInitialized) socket.close(1000, "App closed"); super.onDestroy() }

    inner class Bridge { @JavascriptInterface fun input(data: String) = sendInput(data) }
}
