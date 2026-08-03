class NotificationService {
  constructor({ activities, devices, endpoint = process.env.VERTEX_PUSH_ENDPOINT, key = process.env.VERTEX_PUSH_KEY, appUrl = process.env.VERTEX_APP_URL, fetcher = global.fetch } = {}) { this.activities = activities; this.devices = devices; this.endpoint = endpoint; this.key = key; this.appUrl = appUrl; this.fetcher = fetcher; }
  status() { return { inApp:true, firebaseConfigured:Boolean(this.endpoint && this.key), registeredDevices:this.devices?.read().filter((device) => !device.revoked && device.pushToken).length || 0 }; }
  async send(activity) {
    const tokens = this.devices?.read().filter((device) => !device.revoked && device.pushToken).map((device) => device.pushToken) || [];
    if (!this.endpoint || !this.key || !tokens.length) return { sent:false, reason:"not_configured" };
    const response = await this.fetcher(this.endpoint, { method:"POST", headers:{ "content-type":"application/json", "x-vertex-push-key":this.key }, body:JSON.stringify({ tokens, title:activity.title, type:activity.type, taskId:activity.taskId, session:activity.session, appUrl:this.appUrl }) });
    if (!response.ok) throw new Error(`Push sender returned ${response.status}.`);
    const result = await response.json(); this.devices.removePushTokens(result.invalidTokens || []); return { sent:true, ...result };
  }
}

module.exports = { NotificationService };
