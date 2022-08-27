const { md, pki, random, util } = require('node-forge')
const nullthrows = require('nullthrows')

// a hexString is considered negative if its most significant bit is 1
// because serial numbers use ones' complement notation
// this RFC in section 4.1.2.2 requires serial numbers to be positive
// http://www.ietf.org/rfc/rfc5280.txt
const toPositiveHex = (hexString) => {
  let mostSignificantHexAsInt = parseInt(nullthrows(hexString[0]), 16)
  if (mostSignificantHexAsInt < 8) {
    return hexString
  }
  mostSignificantHexAsInt -= 8
  return mostSignificantHexAsInt.toString(16) + hexString.substring(1)
}

/**
 * Generate a self-signed (root) code-signing certificate valid for use with expo-updates.
 *
 * @returns pki.Certificate valid for expo-updates code signing
 */
const generateSelfSignedCodeSigningCertificate = ({
  keyPair: { publicKey, privateKey },
  validityNotBefore,
  validityNotAfter,
  commonName
}) => {
  const cert = pki.createCertificate()
  cert.publicKey = publicKey
  cert.serialNumber = toPositiveHex(util.bytesToHex(random.getBytesSync(9)))

  cert.validity.notBefore = validityNotBefore
  cert.validity.notAfter = validityNotAfter

  const attrs = [
    {
      name: 'commonName',
      value: commonName
    }
  ]
  cert.setSubject(attrs)
  cert.setIssuer(attrs)

  cert.setExtensions([
    {
      name: 'keyUsage',
      critical: true,
      keyCertSign: false,
      digitalSignature: true,
      nonRepudiation: false,
      keyEncipherment: false,
      dataEncipherment: false
    },
    {
      name: 'extKeyUsage',
      critical: true,
      serverAuth: false,
      clientAuth: false,
      codeSigning: true,
      emailProtection: false,
      timeStamping: false
    }
  ])

  cert.sign(privateKey, md.sha256.create())
  return cert
}

module.exports.generateSelfSigned = async () => {
  const keyPair = pki.rsa.generateKeyPair()
  const validityNotBefore = new Date()
  const validityNotAfter = new Date()
  validityNotAfter.setFullYear(validityNotBefore.getFullYear() + 100)
  const certificate = generateSelfSignedCodeSigningCertificate({
    keyPair,
    validityNotBefore,
    validityNotAfter,
    commonName: 'test'
  })

  const result = {
    // publicKey: pki.privateKeyToPem(keyPair.privateKey),
    privateKey: pki.privateKeyToPem(keyPair.privateKey),
    certificate: pki.certificateToPem(certificate)
  }
  return result
}
