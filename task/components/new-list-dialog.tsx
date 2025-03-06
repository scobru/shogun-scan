"use client"

import type React from "react"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type NewListDialogProps = {
  isOpen: boolean
  onClose: () => void
  onCreateList: (name: string) => void
}

export function NewListDialog({ isOpen, onClose, onCreateList }: NewListDialogProps) {
  const [listName, setListName] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (listName.trim()) {
      onCreateList(listName)
      setListName("")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crea nuova lista</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="py-4">
            <Input
              placeholder="Nome lista"
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              className="w-full"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button type="submit">
              <Plus className="mr-2 h-4 w-4" />
              Crea lista
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

