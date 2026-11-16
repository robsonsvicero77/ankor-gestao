require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const USERS_FILE = path.join(__dirname, 'users.json');
function loadUsers() {
	try {
		return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
	} catch {
		return [];
	}
}
function saveUsers(users) {
	fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}
let users = loadUsers();
const JWT_SECRET = process.env.JWT_SECRET || 'finpredict-secret-key-2024';
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
	res.json({ status: 'ok', message: 'API Node rodando!' });
});

// Dashboard
app.get('/api/dashboard', (req, res) => {
	// Dados simulados
	res.json({
		saldo: 12000.50,
		receitas: 8000.00,
		despesas: 5000.00,
		alertas: [
			{ tipo: 'ATENCAO', mensagem: 'Receita abaixo do esperado' },
			{ tipo: 'OK', mensagem: 'Despesas sob controle' }
		],
		previsao: 13500.00
	});
});

// Register
app.post('/api/auth/register', async (req, res) => {
	const { name, email, password } = req.body;
	if (!name || !email || !password) {
		return res.status(400).json({ detail: 'Todos os campos são obrigatórios.' });
	}
	if (users.find(u => u.email === email)) {
		return res.status(400).json({ detail: 'E-mail já cadastrado.' });
	}
	const password_hash = await bcrypt.hash(password, 10);
	const user = { id: users.length + 1, name, email, password_hash };
	users.push(user);
	saveUsers(users);
	const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
	res.json({ access_token: token, user: { id: user.id, name, email } });
});

// Login
app.post('/api/auth/login', async (req, res) => {
	const { email, password } = req.body;
	users = loadUsers();
	const user = users.find(u => u.email === email);
	if (!user) {
		return res.status(401).json({ detail: 'Usuário ou senha inválidos.' });
	}
	const valid = await bcrypt.compare(password, user.password_hash);
	if (!valid) {
		return res.status(401).json({ detail: 'Usuário ou senha inválidos.' });
	}
	const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
	res.json({ access_token: token, user: { id: user.id, name: user.name, email: user.email } });
});

// Me
app.get('/api/auth/me', (req, res) => {
	const auth = req.headers.authorization;
	if (!auth) return res.status(401).json({ detail: 'Token não enviado.' });
	const token = auth.replace('Bearer ', '');
	try {
		const decoded = jwt.verify(token, JWT_SECRET);
		users = loadUsers();
		const user = users.find(u => u.id === decoded.userId);
		if (!user) return res.status(401).json({ detail: 'Usuário não encontrado.' });
		res.json({ id: user.id, name: user.name, email: user.email });
	} catch {
		res.status(401).json({ detail: 'Token inválido.' });
	}
});

app.listen(PORT, () => {
	console.log(`Servidor Node rodando na porta ${PORT}`);
});