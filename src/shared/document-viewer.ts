export interface DocumentViewerBoundsDto {
  x: number
  y: number
  width: number
  height: number
}

export interface DocumentViewerOpenInputDto {
  url: string
  bounds: DocumentViewerBoundsDto
}

export interface DocumentViewerOpenResultDto {
  opened: true
  url: string
}

export interface DocumentViewerCloseResultDto {
  closed: true
}

export interface DocumentViewerResizeInputDto {
  bounds: DocumentViewerBoundsDto
}

export interface DocumentViewerResizeResultDto {
  resized: true
}
