require('dotenv').config();
const cors = require('cors');
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const db = require('./config/db');
const passport = require('./config/passport');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const treeRoutes = require('./routes/treeRoutes');
const noteRoutes = require('./routes/noteRoutes');
const commentRoutes = require('./routes/commentRoutes');
const likeRoutes = require('./routes/likeRoutes');

const app = express();
const port = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const sessionStore = new MySQLStore({}, db.promise());

app.use(express.json());

app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
}));

app.use(session({
  secret: process.env.SESSION_SECRET || 'christmas_secret_key',
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

app.use(passport.initialize());
app.use(passport.session());

app.get('/', (req, res) => {
  res.send('Christmas Tree API Server is ON!');
});

app.use('/', authRoutes);
app.use('/users', userRoutes);
app.use('/', treeRoutes);
app.use('/trees', noteRoutes);
app.use('/notes', commentRoutes);
app.use('/notes', likeRoutes);

app.listen(port, () => {
  console.log(`API Server running on port:${port}`);
});
