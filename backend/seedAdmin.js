require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { connectDatabase } = require('./db');
const { User } = require('./auth');

async function run() {
    if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
        console.error('MONGO_URI and JWT_SECRET must be set in the environment');
        process.exit(1);
    }
    await connectDatabase();
    const username = process.env.ADMIN_USERNAME || 'admin';
    const email = process.env.ADMIN_EMAIL || 'admin@example.com';
    const password = process.env.ADMIN_PASSWORD || 'adminpass123';

    let user = await User.findOne({ email });
    if (!user) {
        const hashed = await bcrypt.hash(password, 10);
        user = new User({ username, email, password: hashed, isAdmin: true });
        await user.save();
        console.log('Admin user created:', email);
    } else {
        if (!user.isAdmin) {
            user.isAdmin = true;
            await user.save();
            console.log('User promoted to admin:', email);
        } else {
            console.log('Admin user already exists:', email);
        }
    }

    const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' });
    console.log('Use this token for admin requests (store securely):');
    console.log(token);
}

run()
    .then(() => mongoose.disconnect())
    .catch(async (err) => {
        console.error(err);
        await mongoose.disconnect();
        process.exitCode = 1;
    });
