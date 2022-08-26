import React from 'react'
import { Colors } from './Colors'

export const Text = ({ style, bold, italic, size, color, center, upCase, value, title }) => (
  <div
    style={{
      fontWeight: bold ? 'bold' : 'normal',
      fontStyle: italic ? 'italic' : 'normal',
      fontSize: size || 15,
      fontFamily: 'Inter',
      ...(color === 'inherit' ? {} : { color: color || Colors.text }),
      textAlign: center ? 'center' : 'start',
      ...(title ? { fontFamily: 'Inter', fontWeight: 700, color: color || Colors.primary } : {}),
      ...style
    }}
  >
    {upCase && value ? value.toUpperCase() : value}
  </div>
)
