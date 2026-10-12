import {beforeEach,expect,it,vi} from 'vitest'
const fixture=vi.hoisted(()=>({os:'ios',available:vi.fn(),share:vi.fn(),files:[] as any[]}))
vi.mock('react-native',()=>({Platform:{get OS(){return fixture.os}}}))
vi.mock('expo-sharing',()=>({isAvailableAsync:fixture.available,shareAsync:fixture.share}))
vi.mock('expo-file-system',()=>({Paths:{cache:'cache'},File:class{uri='cache/private-report.csv';exists=false;create=vi.fn(()=>{this.exists=true});write=vi.fn();delete=vi.fn(()=>{this.exists=false});constructor(){fixture.files.push(this)}}}))
import {exportCsvFile} from '../lib/csv-export'
beforeEach(()=>{fixture.os='ios';fixture.available.mockReset().mockResolvedValue(true);fixture.share.mockReset().mockResolvedValue(undefined);fixture.files=[]})
it('native export shares an actual BOM CSV file and removes private cache after share completes',async()=>{await exportCsvFile('"Name"\r\n"Helper"','hours.csv','Reviewed hours');expect(fixture.files[0].write).toHaveBeenCalledWith('\ufeff"Name"\r\n"Helper"');expect(fixture.share).toHaveBeenCalledWith('cache/private-report.csv',{mimeType:'text/csv',UTI:'public.comma-separated-values-text',dialogTitle:'Reviewed hours'});expect(fixture.files[0].delete).toHaveBeenCalledOnce()})
it('share failure still deletes private report; unavailable sharing never creates file',async()=>{fixture.share.mockRejectedValueOnce(new Error('Share failed'));await expect(exportCsvFile('private','history.csv','History')).rejects.toThrow('Share failed');expect(fixture.files[0].delete).toHaveBeenCalledOnce();fixture.files=[];fixture.available.mockResolvedValueOnce(false);await expect(exportCsvFile('private','history.csv','History')).rejects.toThrow('unavailable');expect(fixture.files).toHaveLength(0)})
it('rejects file paths supplied as filenames',async()=>{await expect(exportCsvFile('data','../other.csv','Report')).rejects.toThrow('filename');expect(fixture.files).toHaveLength(0)})
