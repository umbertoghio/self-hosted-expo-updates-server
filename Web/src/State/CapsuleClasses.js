import { useCapsule, isObject, localStorage } from './Functions'
import _ from 'lodash'

const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development'

class Capsule {
  constructor (name, initialValue) {
    this.name = name
    this._subscriptions = new Set()
    this._initialValue = initialValue
    this._value = initialValue

    this.setState = this.setState.bind(this)
    this.resetState = this.resetState.bind(this)
    this.subscribe = this.subscribe.bind(this)
    this.unsubscribe = this.unsubscribe.bind(this)
    this.useState = this.useState.bind(this)
  }

  get state () {
    return this._value
  }

  setState (newValue) {
    this._value = newValue
    for (const subscription of this._subscriptions) { subscription() }
    isDev && console.log('SetStore', this.name, isObject(newValue) ? _.omit(newValue, 'jwt') : newValue)
  }

  patchState (newState) {
    if (!isObject(newState) || !isObject(this._value)) return false
    this.setState({ ...this._value, ...newState })
  }

  resetState () {
    this._value = this._initialValue
  }

  subscribe (callback) {
    this._subscriptions.add(callback)
    return () => { this.unsubscribe(callback) }
  }

  unsubscribe (callback) {
    this._subscriptions.delete(callback)
  }

  useState () {
    // eslint-disable-next-line
    return useCapsule(this)
  }
}

class StoredCapsule extends Capsule {
  constructor (name, initialValue) {
    super(name, initialValue)
    const storedState = localStorage.get(name)
    storedState !== null && super.setState(storedState)
  }

  patchState (newValue) {
    super.patchState(newValue)
    window.localStorage.setItem(this.name, JSON.stringify(newValue))
  }

  setState (newState) {
    super.setState(newState)
    window.localStorage.setItem(this.name, JSON.stringify(newState))
  }

  resetState () {
    super.resetState()
    window.localStorage.removeItem(this.name)
  }
}

export { Capsule, StoredCapsule }
