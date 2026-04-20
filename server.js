const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA = {
  users: path.join(__dirname, 'data', 'users.json'),
  posts: path.join(__dirname, 'data', 'posts.json'),
  comments: path.join(__dirname, 'data', 'comments.json'),
};

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// ── AUTH ──────────────────────────────────────────────
app.post('/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'All fields required' });

  const users = read(DATA.users);
  if (users.find(u => u.email === email))
    return res.status(409).json({ error: 'Email already registered' });

  const user = { id: uuidv4(), name, email, password, avatar: '', bio: '', createdAt: new Date().toISOString() };
  users.push(user);
  write(DATA.users, users);
  const { password: _, ...safe } = user;
  res.status(201).json({ message: 'Registered successfully', user: safe });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const users = read(DATA.users);
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const { password: _, ...safe } = user;
  res.json({ message: 'Login successful', user: safe });
});

// ── POSTS ─────────────────────────────────────────────
app.get('/posts', (req, res) => {
  const posts = read(DATA.posts);
  const comments = read(DATA.comments);
  const result = posts
    .map(p => ({ ...p, comments: comments.filter(c => c.postId === p.id) }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(result);
});

app.get('/posts/user/:email', (req, res) => {
  const posts = read(DATA.posts);
  const comments = read(DATA.comments);
  const result = posts
    .filter(p => p.userEmail === req.params.email)
    .map(p => ({ ...p, comments: comments.filter(c => c.postId === p.id) }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(result);
});

app.post('/posts', (req, res) => {
  const { userEmail, userName, content, imageUrl } = req.body;
  if (!userEmail || !content)
    return res.status(400).json({ error: 'userEmail and content required' });

  const posts = read(DATA.posts);
  const post = { id: uuidv4(), userEmail, userName, content, imageUrl: imageUrl || '', likes: [], createdAt: new Date().toISOString() };
  posts.push(post);
  write(DATA.posts, posts);
  res.status(201).json({ ...post, comments: [] });
});

// ── LIKES ─────────────────────────────────────────────
app.post('/like', (req, res) => {
  const { postId, userEmail } = req.body;
  const posts = read(DATA.posts);
  const post = posts.find(p => p.id === postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const idx = post.likes.indexOf(userEmail);
  if (idx === -1) post.likes.push(userEmail);
  else post.likes.splice(idx, 1);

  write(DATA.posts, posts);
  res.json({ likes: post.likes.length, liked: idx === -1 });
});

// ── COMMENTS ──────────────────────────────────────────
app.post('/comment', (req, res) => {
  const { postId, userEmail, userName, text } = req.body;
  if (!postId || !userEmail || !text)
    return res.status(400).json({ error: 'postId, userEmail and text required' });

  const comments = read(DATA.comments);
  const comment = { id: uuidv4(), postId, userEmail, userName, text, createdAt: new Date().toISOString() };
  comments.push(comment);
  write(DATA.comments, comments);
  res.status(201).json(comment);
});

// ── USER PROFILE ──────────────────────────────────────
app.get('/user/:email', (req, res) => {
  const users = read(DATA.users);
  const user = users.find(u => u.email === req.params.email);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { password: _, ...safe } = user;
  res.json(safe);
});

app.put('/user/:email', (req, res) => {
  const users = read(DATA.users);
  const idx = users.findIndex(u => u.email === req.params.email);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  const { name, bio, avatar } = req.body;
  if (name) users[idx].name = name;
  if (bio !== undefined) users[idx].bio = bio;
  if (avatar !== undefined) users[idx].avatar = avatar;
  write(DATA.users, users);
  const { password: _, ...safe } = users[idx];
  res.json(safe);
});

// ── SERVE PAGES ───────────────────────────────────────
const pages = ['login', 'index', 'profile', 'dashboard', 'discover'];
pages.forEach(p => {
  app.get(`/${p === 'index' ? '' : p}`, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', `${p}.html`));
  });
});

app.listen(3000, () => console.log('🚀 SocialConnect running at http://localhost:3000'));
