import { Routes, Route } from 'react-router-dom'
import { TodosProvider } from './store/todos'
import { Header } from './components/Header'
import { TodosPage } from './pages/TodosPage'
import { AboutPage } from './pages/AboutPage'

export default function App() {
  return (
    <TodosProvider>
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
        <Header />
        <Routes>
          <Route path="/" element={<TodosPage />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </div>
    </TodosProvider>
  )
}
