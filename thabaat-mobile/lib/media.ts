export interface MediaItem { id: string; title: string; description: string; category: string; object_path: string; members_only: boolean; published: boolean; created_by: string; created_at: string }
export function filterMedia(items: MediaItem[], search: string, category: string) {
 const needle=search.trim().toLocaleLowerCase()
 return items.filter(i=>(!category || i.category===category) && (!needle || [i.title,i.description,i.category].join(' ').toLocaleLowerCase().includes(needle)))
}
export function safeProgress(seconds: number, duration: number) {
 if (!Number.isFinite(seconds) || seconds<0) return 0
 if (Number.isFinite(duration) && duration>0 && seconds >= duration-5) return 0
 return Math.min(seconds,86399)
}
