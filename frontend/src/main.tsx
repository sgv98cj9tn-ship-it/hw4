import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource-variable/inter'
import '@fontsource/playfair-display/700.css'
import '@fontsource/playfair-display/800.css'
import '@fontsource/graduate'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './auth.tsx'
import { CartProvider } from './cart.tsx'
import { ChatResultsProvider } from './chatResults.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ChatResultsProvider>
          <CartProvider>
            <App />
          </CartProvider>
        </ChatResultsProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
