import { StoredCapsule } from './CapsuleClasses'

export const capsules = {
  user: new StoredCapsule('user', { accessToken: '' })
}
