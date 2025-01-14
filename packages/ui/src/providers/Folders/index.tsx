'use client'
import type { Breadcrumb, FolderAndDocumentsResult, Subfolder } from 'payload/shared'

import { useModal } from '@faceless-ui/modal'
import { useSearchParams } from 'next/navigation.js'
import * as qs from 'qs-esm'
import React from 'react'

import type { FolderInterface } from '../../elements/FolderView/types.js'

import { MoveToFolderDrawer } from '../../elements/FolderView/MoveToFolderDrawer/index.js'
import { useTableColumns } from '../../elements/TableColumns/index.js'
import { parseSearchParams } from '../../utilities/parseSearchParams.js'
import { useConfig } from '../Config/index.js'
import { useEditDepth } from '../EditDepth/index.js'
import { useFolderAndDocumentSelections } from '../FolderAndDocumentSelections/index.js'

const moveToDrawerSlug = 'move-to-folder'

export type FileCardData = {
  filename: string
  id: number | string
  mimeType: string
  name: string
  url: string
}

type FolderContextValue = {
  breadcrumbs?: Breadcrumb[]
  collectionSlug: string
  deleteFolderDocs: (args: (number | string)[]) => Promise<Response | undefined>
  deleteFolders: (args: (number | string)[]) => Promise<Response | undefined>
  docs: FileCardData[]
  folderCollectionSlug: string
  folderID?: number | string
  moveFoldersAndDocs: (args: { toFolderID: number | string }) => Promise<void>
  moveToDocIDs?: (number | string)[]
  moveToDrawerSlug?: string
  moveToFolderIDs?: (number | string)[]
  populateFolderData: (args: { folderID: number | string }) => Promise<void>
  renameFolder: (args: FolderInterface) => void
  setFolderID: (args: { folderID: number | string }) => Promise<void>
  setMoveToDocIDs: (args: (number | string)[]) => void
  setMoveToFolderIDs: (args: (number | string)[]) => void
  subfolders?: Subfolder[]
}

const Context = React.createContext<FolderContextValue>({
  breadcrumbs: [],
  collectionSlug: '',
  deleteFolderDocs: () => Promise.resolve(undefined),
  deleteFolders: () => Promise.resolve(undefined),
  docs: [],
  folderCollectionSlug: '',
  folderID: undefined,
  moveFoldersAndDocs: () => Promise.resolve(undefined),
  moveToDocIDs: [],
  moveToDrawerSlug: '',
  moveToFolderIDs: [],
  populateFolderData: () => Promise.resolve(undefined),
  renameFolder: () => {},
  setFolderID: () => Promise.resolve(undefined),
  setMoveToDocIDs: () => {},
  setMoveToFolderIDs: () => {},
  subfolders: [],
})

export type FolderProviderData = {
  breadcrumbs?: Breadcrumb[]
  docs?: FileCardData[]
  folderID?: number | string
  subfolders?: Subfolder[]
}

type Props = {
  readonly children: React.ReactNode
  readonly collectionSlug: string
  readonly folderCollectionSlug: string
  readonly initialData?: FolderProviderData
}
export function FolderProvider({
  children,
  collectionSlug,
  folderCollectionSlug,
  initialData,
}: Props) {
  const { config } = useConfig()
  const { routes, serverURL } = config
  const { clearSelections, selectedDocs, selectedFolders } = useFolderAndDocumentSelections()
  const searchParams = useSearchParams()
  const editDepth = useEditDepth()
  const { rebuildTableState } = useTableColumns()
  const { closeModal } = useModal()

  const [activeFolderID, setActiveFolderID] = React.useState<FolderContextValue['folderID']>(
    initialData?.folderID,
  )
  const [folderBreadcrumbs, setFolderBreadcrumbs] = React.useState<
    FolderContextValue['breadcrumbs']
  >(initialData?.breadcrumbs || [])
  const [subfolders, setSubfolders] = React.useState<Subfolder[]>(initialData?.subfolders || [])
  const [docs, setDocs] = React.useState<any[]>(initialData?.docs || [])
  const [moveToFolderIDs, setMoveToFolderIDs] = React.useState<(number | string)[]>([])
  const [moveToDocIDs, setMoveToDocIDs] = React.useState<(number | string)[]>([])

  const folderIDFromParams = searchParams.get('folderID') || ''
  const folderIDParamRef = React.useRef(folderIDFromParams || '')

  const populateFolderData = React.useCallback(
    async ({ folderID: folderToPopulate }) => {
      if (editDepth > 0) {
        // when in a drawer, you cannot rely on the server rendered data
        const queryParams = qs.stringify(
          {
            ...parseSearchParams(searchParams),
            folderID: folderToPopulate,
          },
          { addQueryPrefix: true },
        )
        const folderDataReq = await fetch(
          `${serverURL}${routes.api}/${folderCollectionSlug}/populate-folder-data${queryParams}`,
          {
            credentials: 'include',
            headers: {
              'content-type': 'application/json',
            },
          },
        )

        if (folderDataReq.status === 200) {
          const folderDataRes: FolderAndDocumentsResult = await folderDataReq.json()
          if (folderDataRes.breadcrumbs) {
            setFolderBreadcrumbs(folderDataRes.breadcrumbs)
          }

          if (folderDataRes.subfolders) {
            setSubfolders(folderDataRes.subfolders)
          }
          await rebuildTableState({ query: { folderID: folderToPopulate } })
        } else {
          setFolderBreadcrumbs([])
          setSubfolders([])
          await rebuildTableState()
        }
      } else {
        setFolderBreadcrumbs(initialData.breadcrumbs || [])
        setSubfolders(initialData.subfolders || [])
      }
    },
    [
      folderCollectionSlug,
      routes.api,
      serverURL,
      searchParams,
      rebuildTableState,
      editDepth,
      initialData,
    ],
  )

  const setNewActiveFolderID: FolderContextValue['setFolderID'] = React.useCallback(
    async ({ folderID: newActiveFolderID }) => {
      clearSelections()
      setActiveFolderID(newActiveFolderID)
      await populateFolderData({ folderID: newActiveFolderID })
    },
    [clearSelections, populateFolderData],
  )

  // mutations
  const deleteFolderDocs: FolderContextValue['deleteFolderDocs'] = React.useCallback(
    async (docIDs) => {
      if (!docIDs.length) {
        return
      }

      const query = qs.stringify(
        {
          where: {
            id: {
              in: docIDs,
            },
          },
        },
        {
          addQueryPrefix: true,
        },
      )
      const res = await fetch(`${serverURL}${routes.api}/${collectionSlug}${query}`, {
        method: 'DELETE',
      })

      if (res.status === 200) {
        // filter deleted docs from state
        setDocs((prevDocs) => prevDocs.filter((doc) => !docIDs.includes(doc.id)))
      }

      return res
    },
    [collectionSlug, routes.api, serverURL],
  )

  const deleteFolders: FolderContextValue['deleteFolders'] = React.useCallback(
    async (folderIDs) => {
      if (!folderIDs.length) {
        return
      }

      const query = qs.stringify(
        {
          where: {
            id: {
              in: folderIDs,
            },
          },
        },
        {
          addQueryPrefix: true,
        },
      )

      const res = await fetch(`${serverURL}${routes.api}/${folderCollectionSlug}${query}`, {
        method: 'DELETE',
      })

      if (res.status === 200) {
        setSubfolders((prevDocs) => prevDocs.filter((doc) => !folderIDs.includes(doc.id)))
      }

      return res
    },
    [folderCollectionSlug, routes.api, serverURL],
  )

  const moveFoldersAndDocs: FolderContextValue['moveFoldersAndDocs'] = React.useCallback(
    async ({ toFolderID }) => {
      // move folders
      if (moveToFolderIDs?.length) {
        const query = qs.stringify(
          {
            where: {
              id: {
                in: moveToFolderIDs,
              },
            },
          },
          {
            addQueryPrefix: true,
          },
        )
        const movedFoldersReq = await fetch(
          `${serverURL}${routes.api}/${folderCollectionSlug}${query}`,
          {
            body: JSON.stringify({
              parentFolder: toFolderID || null,
            }),
            headers: {
              'content-type': 'application/json',
            },
            method: 'PATCH',
          },
        )

        if (movedFoldersReq.ok) {
          // filter moved folders from state
          setSubfolders((prevFolders) =>
            prevFolders.filter((folder) => !moveToFolderIDs.includes(folder.id)),
          )
        }
      }

      // move files
      if (moveToDocIDs?.length) {
        const query = qs.stringify(
          {
            where: {
              id: {
                in: moveToDocIDs,
              },
            },
          },
          {
            addQueryPrefix: true,
          },
        )

        const movedFilesReq = await fetch(`${serverURL}${routes.api}/${collectionSlug}${query}`, {
          body: JSON.stringify({
            parentFolder: toFolderID || null,
          }),
          headers: {
            'content-type': 'application/json',
          },
          method: 'PATCH',
        })

        if (movedFilesReq.ok) {
          // filter moved files from state
          setDocs((prevDocs) => prevDocs.filter((doc) => !moveToDocIDs.includes(doc.id)))
        }
      }

      // TODO(enhancement): only close if they are all successful
      // TODO(enhancement): show error toast if any of them fail
      // TODO(enhancement): warn users before moving

      closeModal(moveToDrawerSlug)
    },
    [
      closeModal,
      collectionSlug,
      folderCollectionSlug,
      moveToDocIDs,
      moveToFolderIDs,
      routes.api,
      serverURL,
    ],
  )

  const renameFolder: FolderContextValue['renameFolder'] = React.useCallback(
    (updatedFolderDocument) => {
      setSubfolders((prevFolders) =>
        prevFolders.map((folder) => {
          if (folder.id === updatedFolderDocument.id) {
            return {
              ...folder,
              name: updatedFolderDocument.name,
            }
          }
          return folder
        }),
      )
    },
    [],
  )

  // update folderID when url param changes
  // we should not be updating it when inside a drawer
  React.useEffect(() => {
    if (folderIDParamRef.current !== folderIDFromParams) {
      folderIDParamRef.current = folderIDFromParams
      void setNewActiveFolderID({ folderID: folderIDFromParams })
    }
  }, [folderIDFromParams, setNewActiveFolderID])

  return (
    <Context.Provider
      value={{
        breadcrumbs: folderBreadcrumbs,
        collectionSlug,
        deleteFolderDocs,
        deleteFolders,
        docs,
        folderCollectionSlug,
        folderID: activeFolderID,
        moveFoldersAndDocs,
        moveToDocIDs,
        moveToDrawerSlug: `${moveToDrawerSlug}-${editDepth}`,
        moveToFolderIDs,
        populateFolderData,
        renameFolder,
        setFolderID: setNewActiveFolderID,
        setMoveToDocIDs,
        setMoveToFolderIDs,
        subfolders,
      }}
    >
      {children}
      <MoveToFolderDrawer />
    </Context.Provider>
  )
}

export function useFolder(): FolderContextValue {
  const context = React.useContext(Context)

  if (context === undefined) {
    throw new Error('useFolder must be used within a FolderProvider')
  }

  return context
}
