"use client"

import { List, Plus } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"

type ListType = {
  id: string
  name: string
  createdAt: number
}

type TaskListProps = {
  lists: ListType[]
  currentList: string
  onSelectList: (id: string) => void
  isOpen: boolean
  onClose: () => void
  onNewList: () => void
}

export function TaskList({ lists, currentList, onSelectList, isOpen, onClose, onNewList }: TaskListProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Le tue liste</SheetTitle>
        </SheetHeader>
        <div className="py-4 flex-1 overflow-auto">
          <div className="space-y-1">
            {lists
              .sort((a, b) => b.createdAt - a.createdAt)
              .map((list) => (
                <Button
                  key={list.id}
                  variant={currentList === list.id ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => onSelectList(list.id)}
                >
                  <List className="mr-2 h-4 w-4" />
                  {list.name}
                </Button>
              ))}

            {lists.length === 0 && (
              <div className="text-center py-4 text-muted-foreground">Nessuna lista. Creane una nuova!</div>
            )}
          </div>
        </div>
        <SheetFooter>
          <Button className="w-full" onClick={onNewList}>
            <Plus className="mr-2 h-4 w-4" />
            Nuova lista
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

