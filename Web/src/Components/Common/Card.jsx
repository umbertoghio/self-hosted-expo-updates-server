import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Text, Flex, Icon } from '..'
import { Colors } from './Colors'

const transition = { default: { duration: 0.4 } }

export function Card ({ fadeIn, collapsable, title, titleCollapsed, titleStyle, collapsed, children, style, customHeader, onExpand }) {
  const [state, setState] = useState('closed')
  const isCollapsed = state === 'closed'

  const toggleCollapse = (newState) => {
    const applyNewState = newState || (isCollapsed ? 'open' : 'closed')
    setState(applyNewState)
    applyNewState === 'open' && onExpand && onExpand()
  }

  useEffect(() => { collapsable && setState(collapsed ? 'closed' : 'open') }, [collapsable, collapsed])

  const cardStyle = {
    backdropFilter: 'blur(16px) saturate(180%)',
    WebkitBackdropFilter: 'blur(16px) saturate(180%)',
    backgroundColor: 'rgba(17, 25, 40, 0.5)',
    borderRadius: 8,
    border: '1px solid rgba(255, 255, 255, 0.125)',
    padding: 20,
    opacity: fadeIn ? 0 : 1,
    boxShadow: '10px 10px 20px 0px  rgba(100, 100, 100, 0.24)',
    ...(collapsable ? { position: 'relative' } : {}),
    ...(collapsable && isCollapsed && !customHeader ? { cursor: 'pointer' } : {}),
    ...style,
    width: undefined

  }

  return (
    <motion.div
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
      style={{ ...cardStyle, ...(style ? { width: style.width, height: style.height } : {}) }}
      onClick={isCollapsed && !customHeader ? () => toggleCollapse('open') : null}
    >

      {!customHeader && !title
        ? null
        : (
          <Flex row jb fw>
            <Flex row js fw style={{ paddingRight: 30 }}>
              {title ? <Text title bold value={titleCollapsed ? (isCollapsed ? titleCollapsed : title) : title} style={{ ...titleStyle, marginRight: 20 }} size={20} /> : null}
              {customHeader}
            </Flex>
            {collapsable && (
              <motion.div
                initial='closed' animate={state} style={{ cursor: 'pointer' }} onClick={() => (customHeader || !isCollapsed) && toggleCollapse()} variants={{
                  open: { rotate: 0, transition },
                  closed: { rotate: 180, transition }
                }}
              >
                <Icon name='chevron-up' color={Colors.primary} />
              </motion.div>
            )}
          </Flex>)}
      {!collapsable
        ? children
        : (
          <motion.div
            initial='closed' style={{ overflow: 'hidden' }} animate={state}
            variants={{
              open: { height: 'auto', opacity: 1, marginTop: 10, transition },
              closed: { height: 0, opacity: 0, marginTop: 0, transition }
            }}
          >
            {children}
          </motion.div>
          )}
    </motion.div>
  )
}
