import { expect,it } from 'vitest'
import { filterMedia,safeProgress,type MediaItem } from '../lib/media'
const items=[{id:'1',title:'Faith',description:'Evening reflection',category:'Talks'},{id:'2',title:'Service',description:'Volunteer welcome',category:'Training'}] as MediaItem[]
it('combines text and category filters and clears to full list',()=>{expect(filterMedia(items,' EVENING ','Talks')).toHaveLength(1);expect(filterMedia(items,'evening','Training')).toHaveLength(0);expect(filterMedia(items,'','')).toEqual(items)})
it('bounds resume positions and restarts completed video',()=>{expect(safeProgress(NaN,60)).toBe(0);expect(safeProgress(-1,60)).toBe(0);expect(safeProgress(30,60)).toBe(30);expect(safeProgress(57,60)).toBe(0);expect(safeProgress(999999,0)).toBe(86399)})
