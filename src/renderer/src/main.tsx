import { createRoot } from 'react-dom/client'
import App from './App'
import 'highlight.js/styles/github.css'
import './styles.css'

const container = document.getElementById('root')
if (container) createRoot(container).render(<App />)
