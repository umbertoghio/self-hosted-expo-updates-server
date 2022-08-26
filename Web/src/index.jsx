import 'primereact/resources/themes/md-dark-indigo/theme.css'
import 'primereact/resources/primereact.min.css'
import 'primeicons/primeicons.css'

import React, { useState } from 'react'
import ReactDOM from 'react-dom'
import { Background } from './Components/Layout/Background'
import { Notifications } from './Components/Layout/Notifications'
import state, { jwtLogin } from './State'
import { Spinner, TopMenu } from './Components'
import { useMount } from 'react-use'
import { FC } from './Services'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from './Pages/Home'
import Login from './Pages/Login'
import NewApp from './Pages/NewApp'
import AppPage from './Pages/App'
import useForceUpdate from 'use-force-update'
import { ReactQueryDevtools } from 'react-query-devtools'

function App () {
  const forceUpdate = useForceUpdate()
  const [isLoading, setIsLoading] = useState(true)

  useMount(async () => {
    state?.user?.state?.accessToken && await jwtLogin()
    setIsLoading(false)
  })

  if (isLoading) return <Spinner />
  return (
    <BrowserRouter>
      <ReactQueryDevtools initialIsOpen={false} />

      <Background>
        <Notifications />
        {FC.authenticated && <TopMenu />}
        <div
          style={{
            height: '100%',
            overflowX: 'hidden',
            overflowY: 'auto',
            scrollbarWidth: 'none'
          }}
        >
          {!FC.authenticated
            ? <Login handleLogin={() => forceUpdate()} />
            : (
              <Routes>
                <Route path='*' element={<Navigate to='/home' />} />
                <Route path='/home' element={<Home />} />
                <Route path='/new' element={<NewApp />} />
                <Route path='/app/:appId' element={<AppPage />} />
              </Routes>)}
        </div>
      </Background>
    </BrowserRouter>
  )
}

ReactDOM.render(<React.StrictMode><App /></React.StrictMode>, document.getElementById('root'))
