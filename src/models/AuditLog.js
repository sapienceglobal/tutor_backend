import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
        'APPROVE_COURSE', 
        'REJECT_COURSE', 
        'SUSPEND_COURSE', 
        'VERIFY_TUTOR', 
        'BLOCK_TUTOR', 
        'UNBLOCK_TUTOR',
        'UPDATE_SETTINGS',
        'PROCESS_PAYOUT',
        'DELETE_COURSE',
        'DELETE_USER'
    ]
  },
  entityType: {
    type: String,
    required: true,
    enum: ['course', 'tutor', 'user', 'setting', 'payout']
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { timestamps: true });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
