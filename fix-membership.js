const mongoose = require('mongoose');
const InstituteMembership = require('./src/models/InstituteMembership.js').default;

async function fixMembership() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tutor-app');
    console.log('🔗 Connected to MongoDB');
    
    // Create missing institute membership
    const membership = await InstituteMembership.create({
      userId: '6992c365a0265d32ad979993',
      instituteId: '69a12ff7b8aa5aea7114bfe2',
      roleInInstitute: 'admin',
      status: 'active',
      joinedAt: new Date()
    });
    
    console.log('✅ InstituteMembership created:', membership);
    
    // Close connection
    await mongoose.connection.close();
    console.log('🔗 MongoDB connection closed');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixMembership();
