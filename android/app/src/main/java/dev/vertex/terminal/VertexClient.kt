package dev.vertex.terminal

import okhttp3.*
import org.json.JSONArray
import org.json.JSONObject

class VertexClient(private val endpoint: String, private val token: String) {
    private val http = OkHttpClient()
    private fun request(path: String) = Request.Builder().url(endpoint.trimEnd('/') + path)
        .header("Authorization", "Bearer $token").build()

    fun sessions(callback: (Result<JSONArray>) -> Unit) {
        http.newCall(request("/sessions")).enqueue(object : Callback {
            override fun onFailure(call: Call, e: java.io.IOException) = callback(Result.failure(e))
            override fun onResponse(call: Call, response: Response) {
                response.use {
                    if (!it.isSuccessful) return callback(Result.failure(IllegalStateException("Agent returned ${it.code}")))
                    callback(Result.success(JSONObject(it.body.string()).getJSONArray("sessions")))
                }
            }
        })
    }

    fun socket(listener: WebSocketListener): WebSocket {
        val wsUrl = endpoint.replaceFirst("https://", "wss://").replaceFirst("http://", "ws://").trimEnd('/') + "/?token=$token"
        return http.newWebSocket(Request.Builder().url(wsUrl).build(), listener)
    }
}
