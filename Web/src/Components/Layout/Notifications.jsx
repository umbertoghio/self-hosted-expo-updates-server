import { React } from 'react'
import { Toast } from 'primereact/toast'

export const Notifications = () => {
  return (
    <Toast
      ref={(el) => {
        window.toast = el
      }}
    />
  )
}
