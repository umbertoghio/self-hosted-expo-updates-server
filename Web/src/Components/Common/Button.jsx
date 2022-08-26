import React from 'react'
import { motion } from 'framer-motion'

import { Colors, Icon, Text } from '..'

export function Button ({ round, disabled, icon, label, onClick, style, iconStyle, width, hidden }) {
  const buttonStyle = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: Colors.primary,
    borderRadius: 8,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    userSelect: 'none',
    padding: 10,
    width,
    ...(label ? { paddingLeft: 20, paddingRight: 20 } : {}),
    ...(round ? { width: 30, height: 30 } : {}),
    ...(disabled ? { boxShadow: '', opacity: 0.6 } : { boxShadow: '0px 4px 13px 3px rgba(100, 100, 100, 0.14)' }),
    ...style

  }

  return hidden
    ? null
    : (
      <motion.div
        whileTap={disabled ? '' : 'click'}
        whileHover={disabled ? '' : 'hovered'}
        variants={{
          click: { scale: 1, boxShadow: '5px 5px 13px 3px rgba(255, 255, 255, 0.24)' },
          hovered: { scale: 1.05, boxShadow: '0px 4px 13px 3px rgba(255, 255, 255, 0.44)' }
        }}
        onTap={disabled ? null : onClick}
        style={buttonStyle}
      >
        {icon ? <Icon color={Colors.iconOnPrimary} name={icon} size={16} style={{ marginLeft: -2, ...iconStyle }} /> : null}
        {label ? (<Text color={Colors.textOnPrimary} title bold upCase size={16} center value={label} style={{ marginLeft: icon ? 15 : 0, flexGrow: width ? 1 : 0, textAlign: 'center' }} />) : null}
      </motion.div>
      )
}
