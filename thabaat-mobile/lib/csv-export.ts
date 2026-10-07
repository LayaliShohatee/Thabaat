import { Platform } from 'react-native'
// Native files are kept in app-private cache only while the user chooses a share destination.
export async function exportCsvFile(csv:string,filename:string,title:string):Promise<void>{
 if(!/^[a-zA-Z0-9_-]+\.csv$/.test(filename))throw new Error('Invalid export filename')
 const content='\ufeff'+csv
 if(Platform.OS==='web'){
  const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}))
  try{const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;document.body.appendChild(anchor);anchor.click();anchor.remove()}
  finally{URL.revokeObjectURL(url)}
  return
 }
 const [fileSystem,sharing]=await Promise.all([import('expo-file-system'),import('expo-sharing')])
 if(!await sharing.isAvailableAsync())throw new Error('File sharing is unavailable on this device.')
 const file=new fileSystem.File(fileSystem.Paths.cache,`${Date.now()}-${filename}`)
 try{file.create({overwrite:true});file.write(content);await sharing.shareAsync(file.uri,{mimeType:'text/csv',UTI:'public.comma-separated-values-text',dialogTitle:title})}
 finally{if(file.exists)file.delete()}
}
