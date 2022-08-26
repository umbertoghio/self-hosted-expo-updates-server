import React from 'react'
import { omit } from 'lodash'
import useForceUpdate from 'use-force-update'

export const objectMap = (obj, fn) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fn(k, v)]))

export const dumpStates = (state) => Object.values(state).map(({ state }) => omit(state, 'accessToken'))

export const resetStates = (state) => Object.values(state).map(a => a.resetState())

export const isObject = (obj) => obj !== null && typeof obj === 'object'

export const useCapsule = (capsule) => {
  const forceUpdate = useForceUpdate()

  const setState = React.useCallback((newValue) => {
    const newState = typeof newValue !== 'function' ? newValue : newValue(capsule.state)
    capsule.setState(newState)
  }, [capsule])

  React.useLayoutEffect(() => capsule.subscribe(forceUpdate), [capsule, forceUpdate])

  return [capsule.state, setState]
}

export const localStorage = {
  get: (key) => { try { return JSON.parse(window.localStorage.getItem(key)) } catch (e) { } return null },
  set: (key, value) => { try { window.localStorage.setItem(key, JSON.stringify(value)) } catch (e) { } },
  remove: (key) => { try { window.localStorage.removeItem(key) } catch (e) { } }
}
