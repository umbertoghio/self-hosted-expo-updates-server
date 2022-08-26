import React from 'react'
import { ProgressSpinner } from 'primereact/progressspinner'

export function Spinner ({ size }) {
  return (
    <ProgressSpinner style={{ width: `${size || 40}px`, height: `${size || 40}px`, marginTop: '10px' }} strokeWidth='8' />
  )
}
