import { io } from 'socket.io-client'

const SOCKET_URL = 'http://localhost:4000'
console.log('Povezivanje na socket server:', SOCKET_URL)

const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'], // Pokušavamo oba transportna metoda
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 10,
  autoConnect: true // Automatsko povezivanje pri inicijalizaciji
})

// Debug logovi
socket.on('connect', () => {
  console.log('Socket povezan! ID:', socket.id)
})

socket.on('connect_error', (error) => {
  console.error('Socket greška povezivanja:', error)
})

socket.on('disconnect', (reason) => {
  console.log('Socket prekinut:', reason)
})

// Pokušaj ponovnog povezivanja ako se veza prekine
socket.io.on('reconnect_attempt', (attempt) => {
  console.log(`Pokušaj ponovnog povezivanja #${attempt}`)
})

socket.io.on('reconnect', (attempt) => {
  console.log(`Ponovo povezan nakon ${attempt} pokušaja`)
})

// Exportujemo socket instancu
export default socket