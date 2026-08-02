class NotificationService {
  constructor({ activities, firebaseProjectId = process.env.VERTEX_FIREBASE_PROJECT_ID } = {}) { this.activities = activities; this.firebaseConfigured = Boolean(firebaseProjectId); }
  status() { return { inApp:true, firebaseConfigured:this.firebaseConfigured }; }
}

module.exports = { NotificationService };
