import { Button, Text, Input } from '../../Components'
import { FC } from '../../Services'
const example = `# Expo publish to local folder
cd /my/app/folder
yarn expo export --experimental-bundle --output-dir /path/to/build/folder

# Add app.json & package.json to the build for info & Metadata
cp app.json /path/to/build/folder/
cp package.json /path/to/build/folder/

# Compress update folder (from within it to avoid full paths)
cd /path/to/build/folder
zip -q updatename.zip -r ./*
cd -

# Upload update to server
curl --location --request POST 'http://my.server:3000/upload' \\ 
--form "uri=@/path/to/updatename.zip" \\ 
--header "project: expoSlugName" \\ 
--header "version: 1.1.1" \\ 
--header "release-channel: staging" \\ 
--header "upload-key: abc123TheKeySetOnServer" \\ 
--header "git-branch: $(git rev-parse --abbrev-ref HEAD)" \\ 
--header "git-commit: $(git log --oneline -n 1)"
`

const handleDownload = () => {
  const link = document.createElement('a')
  link.href = `${FC.server}/expo-publish-selfhosted.sh`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export const UpdateInstructions = ({ app }) => {
  console.log(FC.server)
  return (
    <>
      <Text value='There are no updates found.' />
      <Button icon='download' label='Download publish script' onClick={handleDownload} style={{ marginTop: 20, marginBottom: 20, width: 300 }}>Create</Button>

      <Text value='Or Build your own script:' />
      <Input multiline rows={10} useState={[example, () => null]} style={{ marginTop: 10, width: '100%' }} />
    </>
  )
}
