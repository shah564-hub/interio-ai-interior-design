
import { useState, useEffect } from 'react'
import './App.css'
import Auth from './Auth'
import { supabase } from './supabaseClient'

// --------------------------------------------------
// INTERIO DESIGN STYLES
// --------------------------------------------------

const styles = [
  {
    name: 'Modern Minimal',
    category: 'Clean & calm',
    image: 'photo-1600210492486-724fe5c67fb0',
  },
  {
    name: 'Scandinavian',
    category: 'Warm & natural',
    image: 'photo-1600607687939-ce8a6c25118c',
  },
  {
    name: 'Japandi',
    category: 'Soft & balanced',
    image: 'photo-1600566753086-00f18fb6b3ea',
  },
  {
    name: 'Contemporary',
    category: 'Bold & refined',
    image: 'photo-1600607687920-4e2a09cf159d',
  },
]

const imageUrl = (id, width = 700) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`

// --------------------------------------------------
// INDEXEDDB - PERMANENT BROWSER PROJECT STORAGE
// --------------------------------------------------

// --------------------------------------------------
// SUPABASE PROJECT STORAGE
// --------------------------------------------------

const BUCKET_NAME = 'interio-designs'

// Load projects belonging to the logged-in user.
async function getAllProjects(userId) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error

  const projects = await Promise.all(
    data.map(async project => {
      const { data: signedImage, error: imageError } =
        await supabase.storage
          .from(BUCKET_NAME)
          .createSignedUrl(project.image_url, 3600)

      if (imageError) throw imageError

      return {
        id: project.id,
        name: project.name,
        room: project.room,
        style: project.style,
        budget: project.budget,
        image: signedImage.signedUrl,
        imagePath: project.image_url,
        generated: project.generated,
        createdAt: project.created_at,
      }
    })
  )

  return projects
}

// Upload image and save project details.
async function saveProjectToDB(project, userId) {
  const imageResponse = await fetch(project.image)
  if (!imageResponse.ok) {
    throw new Error('Unable to prepare the project image.')
  }

  const imageBlob = await imageResponse.blob()

  const extension =
    imageBlob.type === 'image/webp'
      ? 'webp'
      : imageBlob.type === 'image/png'
        ? 'png'
        : 'jpg'

  const imagePath =
    `${userId}/${crypto.randomUUID()}.${extension}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(imagePath, imageBlob, {
      contentType: imageBlob.type || 'image/jpeg',
      upsert: false,
    })

  if (uploadError) throw uploadError

  const { error: insertError } = await supabase
    .from('projects')
    .insert({
      id: project.id,
      user_id: userId,
      name: project.name,
      room: project.room,
      style: project.style,
      budget: project.budget,
      image_url: imagePath,
      generated: project.generated,
    })

  if (insertError) {
    await supabase.storage.from(BUCKET_NAME).remove([imagePath])
    throw insertError
  }

  return true
}

// Delete project and its stored image.
async function deleteProjectFromDB(project) {
  if (project.imagePath) {
    const { error: storageError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([project.imagePath])

    if (storageError) throw storageError
  }

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', project.id)

  if (error) throw error

  return true
}

// Convert an uploaded image into persistent image data.
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)

    reader.readAsDataURL(file)
  })
}

// --------------------------------------------------
// MAIN APP
// --------------------------------------------------

function App() {
  const [selectedStyle, setSelectedStyle] = useState('Modern Minimal')
  const [room, setRoom] = useState('Bedroom')
  const [budget, setBudget] = useState('₹50k – ₹1L')

  const [uploadedImage, setUploadedImage] = useState('')
  const [uploadedFile, setUploadedFile] = useState(null)

  const [generated, setGenerated] = useState(false)
  const [generatedImage, setGeneratedImage] = useState('')

  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState('')

  const [activeTab, setActiveTab] = useState('Discover')
  const [session, setSession] = useState(null)
 const [authLoading, setAuthLoading] = useState(true)

  // Saved projects are loaded from IndexedDB.
  const [saved, setSaved] = useState([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [projectMessage, setProjectMessage] = useState('')

  const [selectedProject, setSelectedProject] = useState(null)

  // --------------------------------------------------
  // LOAD SAVED PROJECTS WHEN APP OPENS
  // --------------------------------------------------
   useEffect(() => {
  let mounted = true

  async function checkSession() {
    const { data, error } = await supabase.auth.getSession()

    if (mounted) {
      if (error) console.error('Session error:', error)

      setSession(data?.session ?? null)
      setAuthLoading(false)
    }
  }

  checkSession()

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, newSession) => {
    setSession(newSession)
  })

  return () => {
    mounted = false
    subscription.unsubscribe()
  }
}, [])
  useEffect(() => {
  let mounted = true

  async function loadProjects() {
    if (!session?.user?.id) {
      setSaved([])
      setIsLoadingProjects(false)
      return
    }

    setIsLoadingProjects(true)

    try {
      const projects = await getAllProjects(session.user.id)

      if (mounted) {
        setSaved(projects)
      }
    } catch (error) {
      console.error('Error loading projects:', error)
    } finally {
      if (mounted) {
        setIsLoadingProjects(false)
      }
    }
  }

  loadProjects()

  return () => {
    mounted = false
  }
}, [session?.user?.id])

  // --------------------------------------------------
  // IMAGE UPLOAD
  // --------------------------------------------------

  function handleUpload(event) {
    const file = event.target.files?.[0]

    if (!file) return

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setGenerationError('Please choose a JPG, PNG, or WebP image.')
      event.target.value = ''
      return
    }

    if (file.size > 8 * 1024 * 1024) {
      setGenerationError('Please choose an image smaller than 8 MB.')
      event.target.value = ''
      return
    }

    if (uploadedImage) {
      URL.revokeObjectURL(uploadedImage)
    }

    setUploadedFile(file)
    setUploadedImage(URL.createObjectURL(file))

    setGeneratedImage('')
    setGenerated(false)
    setGenerationError('')
    setProjectMessage('')
  }

  function removePhoto() {
    if (uploadedImage) {
      URL.revokeObjectURL(uploadedImage)
    }

    setUploadedImage('')
    setUploadedFile(null)
    setGeneratedImage('')
    setGenerated(false)
    setGenerationError('')

    const input = document.querySelector('input[type="file"]')

    if (input) input.value = ''
  }

  // --------------------------------------------------
  // AI IMAGE GENERATION
  // --------------------------------------------------

  async function createConcept() {
    if (!uploadedFile) {
      setGenerationError(
        'Please upload a room photo before generating your design.'
      )

      document.getElementById('create')?.scrollIntoView({
        behavior: 'smooth',
      })

      return
    }

    setIsGenerating(true)
    setGenerationError('')
    setGeneratedImage('')
    setGenerated(false)

    document.getElementById('results')?.scrollIntoView({
      behavior: 'smooth',
    })

    try {
      const formData = new FormData()

      formData.append('roomImage', uploadedFile)
      formData.append('room', room)
      formData.append('style', selectedStyle)
      formData.append('budget', budget)

      const response = await fetch(
        'http://localhost:3001/api/redesign',
        {
          method: 'POST',
          body: formData,
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.error || 'Unable to generate your design.'
        )
      }

      if (!data.image) {
        throw new Error('The AI service returned no image.')
      }

      setGeneratedImage(data.image)
      setGenerated(true)

      setTimeout(() => {
        document.getElementById('results')?.scrollIntoView({
          behavior: 'smooth',
        })
      }, 100)
    } catch (error) {
      setGenerationError(
        error.message || 'Something went wrong. Please try again.'
      )
    } finally {
      setIsGenerating(false)
    }
  }

  // --------------------------------------------------
  // SAVE PROJECT PERMANENTLY
  // --------------------------------------------------

  async function saveDirection() {
    if (isSaving) return

    setIsSaving(true)
    setProjectMessage('')

    try {
      let imageToSave

      if (generatedImage) {
        // Save the actual AI-generated image.
        imageToSave = generatedImage
      } else if (uploadedFile) {
        // Save the uploaded room image.
        imageToSave = await fileToDataURL(uploadedFile)
      } else {
        // Allow inspiration designs to be saved too.
        const selected = styles.find(
          item => item.name === selectedStyle
        )

        imageToSave = imageUrl(
          selected?.image || styles[0].image,
          900
        )
      }

      const project = {
        id: crypto.randomUUID(),
        name: `${room} · ${selectedStyle}`,
        room,
        style: selectedStyle,
        budget,
        image: imageToSave,
        generated,
        createdAt: new Date().toISOString(),
      }

      await saveProjectToDB(project, session.user.id)

      const updatedProjects = await getAllProjects(session.user.id)

      setSaved(updatedProjects)
      setProjectMessage('Your design has been saved successfully.')
    } catch (error) {
      console.error('Project saving error:', error)

      setProjectMessage(
        'Unable to save this design. Please try again.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  // --------------------------------------------------
  // DELETE PROJECT
  // --------------------------------------------------

  async function deleteProject(id) {

    const confirmed = window.confirm(
      'Are you sure you want to delete this saved design?'
    )

    if (!confirmed) return
    const projectToDelete = saved.find(project => project.id === id)

if (!projectToDelete) return

    try {
      await deleteProjectFromDB(projectToDelete)

      const updatedProjects = await getAllProjects(session.user.id)

      setSaved(updatedProjects)

      if (selectedProject?.id === id) {
        setSelectedProject(null)
      }

      setProjectMessage('Project deleted successfully.')
    } catch (error) {
      console.error('Project deletion error:', error)

      setProjectMessage('Unable to delete this project.')
    }
  }

  // --------------------------------------------------
  // DOWNLOAD GENERATED IMAGE
  // --------------------------------------------------

  function downloadImage() {
    if (!generatedImage) return

    const link = document.createElement('a')

    link.href = generatedImage

    link.download =
      `interio-${room.toLowerCase().replace(/\s+/g, '-')}-redesign.png`

    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  // --------------------------------------------------
  // NAVIGATION
  // --------------------------------------------------

  function navigateTo(item) {
    setActiveTab(item)

    if (item === 'Discover') {
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      })
    }

    if (item === 'Style Library') {
      document.getElementById('styles')?.scrollIntoView({
        behavior: 'smooth',
      })
    }

    if (item === 'My Projects') {
      document.getElementById('projects')?.scrollIntoView({
        behavior: 'smooth',
      })
    }

    if (item === 'Inspiration') {
      document.getElementById('inspiration')?.scrollIntoView({
        behavior: 'smooth',
      })
    }
  }

  // --------------------------------------------------
  // AUTHENTICATION
  // --------------------------------------------------

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('Sign-out error:', error)
      setProjectMessage('Unable to sign out. Please try again.')
    }
  }

  // --------------------------------------------------
  // SAVED STATUS
  // --------------------------------------------------

  const currentProjectAlreadySaved = saved.some(
    project =>
      project.room === room &&
      project.style === selectedStyle &&
      project.budget === budget &&
      project.image === generatedImage
  )

  if (authLoading) {
    return <div className="app-shell">Loading Interio...</div>
  }

  if (!session) {
    return <Auth onAuthenticated={setSession} />
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#home">
          <span className="brand-icon">i.</span>

          <span>
            interio
            <small>DESIGN YOUR EVERYDAY</small>
          </span>
        </a>

        <div className="workspace-label">WORKSPACE</div>

        {['Discover', 'Style Library', 'My Projects', 'Inspiration'].map(
          (item, index) => (
            <button
              key={item}
              className={`nav-item ${
                activeTab === item ? 'active' : ''
              }`}
              onClick={() => navigateTo(item)}
            >
              <span>{['◈', '▦', '◇', '✳'][index]}</span>

              {item}

              {item === 'My Projects' && (
                <span className="nav-count">{saved.length}</span>
              )}
            </button>
          )
        )}

        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-sparkle">✳</span>

            <strong>Your dream room, reimagined.</strong>

            <p>Small changes. Beautiful transformations.</p>
          </div>

          <div className="profile">
            <div className="avatar">I</div>

            <div>
              <strong>Interior Enthusiast</strong>
              <small>Free workspace</small>
            </div>

            <button
  type="button"
  className="profile-menu"
  onClick={handleSignOut}
  aria-label="Sign out"
  title="Logout"
  style={{
    border: '1px solid #e5e1d7',
    background: '#f8f7f3',
    color: '#77765f',
    fontSize: '12px',
    fontWeight: 600,
    padding: '9px 12px',
    borderRadius: '9px',
    cursor: 'pointer',
  }}
>
  ↪ Logout
</button>
          </div>
        </div>
      </aside>

      <main className="main-content" id="home">
        <header className="topbar">
          <div className="breadcrumbs">
            Workspace <span>/</span> <strong>{activeTab}</strong>
          </div>

          <div className="topbar-right">
            <span className="status-dot" />
            Your creative space

            <div className="top-avatar">I</div>
          </div>
        </header>

        <div className="page-wrap">

          {/* WELCOME SECTION */}

          <section className="welcome">
            <div>
              <div className="eyebrow">
                <span /> YOUR SPACE, YOUR STORY
              </div>

              <h1>
                Make room for
                <br />
                <em>beautiful living.</em>
              </h1>

              <p>
                Thoughtful interiors start with a single idea.
                Let's turn yours into a space you'll love coming home to.
              </p>

              <a className="text-link" href="#create">
                Explore your possibilities <span>↗</span>
              </a>
            </div>

            <div className="welcome-image">
              <img
                src={imageUrl(
                  'photo-1600210492486-724fe5c67fb0',
                  1000
                )}
                alt="Sunlit contemporary living room"
              />

              <div className="image-caption">
                <span className="caption-dot" />

                <div>
                  <strong>Spaces that feel like you</strong>
                  <small>Designed around your life</small>
                </div>
              </div>

              <span className="image-index">01 — 04</span>
            </div>

            <div className="welcome-stamp">
              ✳
              <small>
                LIVE
                <br />
                BEAUTIFULLY
              </small>
            </div>
          </section>

          {/* CREATE SECTION */}

          <section className="create-section" id="create">
            <div className="section-heading">
              <div>
                <div className="eyebrow">LET'S GET CREATIVE</div>
                <h2>
                  Start with your space<span>.</span>
                </h2>
              </div>

              <p>
                A few details help us shape a room that feels uniquely yours.
              </p>
            </div>

            <div className="creation-grid">
              <div className="upload-card">
                <div className="card-topline">
                  <span>01 / YOUR ROOM</span>
                  <span className="subtle-label">PHOTO STUDIO</span>
                </div>

                <label
                  className={`upload-zone ${
                    uploadedImage ? 'has-image' : ''
                  }`}
                >
                  {uploadedImage ? (
                    <img
                      src={uploadedImage}
                      alt="Your uploaded room"
                    />
                  ) : (
                    <>
                      <div className="upload-icon">↑</div>
                      <strong>Bring your room in</strong>
                      <span>Drop a photo here or browse files</span>
                      <small>JPG, PNG, WebP · Max 8 MB</small>
                    </>
                  )}

                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleUpload}
                  />
                </label>

                {uploadedImage && (
                  <button
                    className="remove-photo"
                    onClick={removePhoto}
                  >
                    Remove photo ×
                  </button>
                )}

                <div className="upload-footnote">
                  <span>◇</span> Your photo is sent to the AI service
                  only when you generate a redesign.
                </div>
              </div>

              <div className="preferences-card">
                <div className="card-topline">
                  <span>02 / YOUR VISION</span>
                  <span className="subtle-label">PERSONALISE</span>
                </div>

                <label className="field-label">
                  What are we refreshing?
                </label>

                <div className="room-options">
                  {[
                    'Bedroom',
                    'Living room',
                    'Kitchen',
                    'Workspace',
                  ].map(item => (
                    <button
                      key={item}
                      className={
                        room === item
                          ? 'choice selected'
                          : 'choice'
                      }
                      onClick={() => setRoom(item)}
                    >
                      <span>
                        {item === 'Bedroom'
                          ? '▱'
                          : item === 'Living room'
                            ? '⌂'
                            : item === 'Kitchen'
                              ? '◫'
                              : '▤'}
                      </span>

                      {item}
                    </button>
                  ))}
                </div>

                <label
                  className="field-label style-label"
                  htmlFor="style-select"
                >
                  Choose your design language
                </label>

                <select
                  id="style-select"
                  value={selectedStyle}
                  onChange={event =>
                    setSelectedStyle(event.target.value)
                  }
                >
                  {styles.map(item => (
                    <option key={item.name}>{item.name}</option>
                  ))}
                </select>

                <label
                  className="field-label budget-label"
                  htmlFor="budget-select"
                >
                  Your estimated budget
                </label>

                <select
                  id="budget-select"
                  value={budget}
                  onChange={event => setBudget(event.target.value)}
                >
                  <option>Under ₹25k</option>
                  <option>₹25k – ₹50k</option>
                  <option>₹50k – ₹1L</option>
                  <option>₹1L – ₹3L</option>
                  <option>₹3L+</option>
                </select>

                <button
                  className="generate-button"
                  onClick={createConcept}
                  disabled={isGenerating}
                >
                  {isGenerating
                    ? 'Redesigning your room...'
                    : 'Generate AI redesign'}

                  <span>{isGenerating ? '…' : '↗'}</span>
                </button>

                {generationError && (
                  <p
                    role="alert"
                    style={{
                      color: '#b54738',
                      marginTop: 12,
                    }}
                  >
                    {generationError}
                  </p>
                )}

                {isGenerating && (
                  <p role="status" style={{ marginTop: 12 }}>
                    ✳ Our AI is reimagining your space.
                    This may take a little while.
                  </p>
                )}

                <p className="prototype-note">
                  ✳ Choose your preferences, then generate a redesigned
                  image of your room.
                </p>
              </div>
            </div>
          </section>

          {/* STYLE LIBRARY */}

          <section className="styles-section" id="styles">
            <div className="section-heading">
              <div>
                <div className="eyebrow">FIND YOUR FEELING</div>

                <h2>
                  Explore the aesthetics<span>.</span>
                </h2>
              </div>

              <span className="small-note">
                A good room feels like you.
              </span>
            </div>

            <div className="style-grid">
              {styles.map((item, index) => (
                <button
                  className={`style-card ${
                    selectedStyle === item.name
                      ? 'style-active'
                      : ''
                  }`}
                  key={item.name}
                  onClick={() => setSelectedStyle(item.name)}
                >
                  <div className="style-image">
                    <img
                      src={imageUrl(item.image, 650)}
                      alt={`${item.name} interior style`}
                    />

                    <span className="style-number">
                      0{index + 1}
                    </span>

                    <span className="style-arrow">↗</span>
                  </div>

                  <div className="style-card-copy">
                    <div>
                      <h3>{item.name}</h3>
                      <p>{item.category}</p>
                    </div>

                    <span className="select-indicator">
                      {selectedStyle === item.name ? '✓' : '+'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* RESULTS SECTION */}

          <section className="results-section" id="results">
            <div className="section-heading">
              <div>
                <div className="eyebrow">YOUR DESIGN JOURNEY</div>

                <h2>
                  {generated
                    ? 'A direction for your space.'
                    : 'Imagine what’s possible.'}
                </h2>
              </div>

              {generated && (
                <span className="result-pill">
                  AI REDESIGN READY
                </span>
              )}
            </div>

            <div className="result-panel">
              <div className="result-image">
                <img
                  src={
                    generatedImage ||
                    uploadedImage ||
                    imageUrl(
                      styles.find(
                        style => style.name === selectedStyle
                      )?.image || styles[0].image,
                      900
                    )
                  }
                  alt={
                    generatedImage
                      ? 'AI-redesigned room'
                      : uploadedImage
                        ? 'Uploaded room preview'
                        : 'Room inspiration concept'
                  }
                />
              </div>

              <div className="result-copy">
                <span className="result-kicker">
                  {generated
                    ? 'YOUR AI-GENERATED CONCEPT'
                    : 'A LITTLE INSPIRATION'}
                </span>

                <h3>
                  {selectedStyle}
                  <br />
                  <em>{room} edit.</em>
                </h3>

                <p>
                  {generated
                    ? 'Your room has been redesigned according to your selected style and budget.'
                    : 'A considered palette, natural textures and pieces that make everyday life feel a little more special.'}
                </p>

                <div className="result-details">
                  <div>
                    <small>ROOM</small>
                    <strong>{room}</strong>
                  </div>

                  <div>
                    <small>STYLE</small>
                    <strong>{selectedStyle}</strong>
                  </div>

                  <div>
                    <small>BUDGET</small>
                    <strong>{budget}</strong>
                  </div>
                </div>

                <button
                  className="save-button"
                  onClick={saveDirection}
                  disabled={isSaving || currentProjectAlreadySaved}
                >
                  {isSaving
                    ? 'Saving project...'
                    : currentProjectAlreadySaved
                      ? '✓ Saved to projects'
                      : '＋ Save this direction'}
                </button>

                {generatedImage && (
                  <button
                    className="save-button"
                    onClick={downloadImage}
                    style={{ marginTop: 10 }}
                  >
                    ↓ Download redesigned image
                  </button>
                )}

                {projectMessage && (
                  <p
                    role="status"
                    style={{
                      marginTop: 12,
                      fontSize: 13,
                    }}
                  >
                    {projectMessage}
                  </p>
                )}

                {generated && generatedImage && (
                  <p className="prototype-note">
                    ✳ AI-generated concept · {selectedStyle} · {room}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* MY PROJECTS - PERMANENT GALLERY */}

          <section
            className="results-section"
            id="projects"
            style={{ marginTop: 80 }}
          >
            <div className="section-heading">
              <div>
                <div className="eyebrow">YOUR PERSONAL COLLECTION</div>

                <h2>
                  My projects<span>.</span>
                </h2>
              </div>

              <span className="small-note">
                {saved.length} saved {saved.length === 1 ? 'design' : 'designs'}
              </span>
            </div>

            {projectMessage && (
              <p role="status" style={{ marginBottom: 20 }}>
                {projectMessage}
              </p>
            )}

            {isLoadingProjects ? (
              <p>Loading your saved designs...</p>
            ) : saved.length === 0 ? (
              <div
                style={{
                  padding: '55px 25px',
                  textAlign: 'center',
                  border: '1px solid #e8e4dc',
                  borderRadius: 18,
                  background: '#fff',
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 15 }}>
                  ✳
                </div>

                <h3 style={{ marginBottom: 10 }}>
                  Your collection starts here.
                </h3>

                <p style={{ color: '#888', marginBottom: 20 }}>
                  Save your favourite room designs and find them here
                  whenever you return.
                </p>

                <button
                  className="save-button"
                  onClick={() => navigateTo('Discover')}
                  style={{ maxWidth: 220, margin: 'auto' }}
                >
                  Explore designs
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fill, minmax(250px, 1fr))',
                  gap: 22,
                }}
              >
                {saved.map(project => (
                  <article
                    key={project.id}
                    style={{
                      background: '#fff',
                      border: '1px solid #e8e4dc',
                      borderRadius: 16,
                      overflow: 'hidden',
                    }}
                  >
                    <img
                      src={project.image}
                      alt={`${project.style} ${project.room}`}
                      style={{
                        width: '100%',
                        height: 220,
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />

                    <div style={{ padding: 18 }}>
                      <div className="eyebrow">
                        {project.generated
                          ? 'AI-GENERATED DESIGN'
                          : 'SAVED DESIGN'}
                      </div>

                      <h3 style={{ margin: '10px 0' }}>
                        {project.style}
                      </h3>

                      <p style={{ color: '#777', fontSize: 13 }}>
                        {project.room} · {project.budget}
                      </p>

                      <p
                        style={{
                          color: '#999',
                          fontSize: 12,
                          marginTop: 10,
                        }}
                      >
                        Saved{' '}
                        {new Date(project.createdAt).toLocaleDateString()}
                      </p>

                      <div
                        style={{
                          display: 'flex',
                          gap: 10,
                          marginTop: 18,
                        }}
                      >
                        <button
                          className="save-button"
                          onClick={() => setSelectedProject(project)}
                          style={{ flex: 1 }}
                        >
                          View design
                        </button>

                        <button
                          className="save-button"
                          onClick={() => deleteProject(project.id)}
                          title="Delete project"
                          style={{
                            width: 48,
                            color: '#b54738',
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* INSPIRATION SECTION */}

          <section className="inspiration-section" id="inspiration">
            <div>
              <div className="eyebrow">A NOTE ON GOOD DESIGN</div>

              <h2>
                Make space for
                <br />
                <em>what matters.</em>
              </h2>
            </div>

            <img
              src={imageUrl(
                'photo-1600607687939-ce8a6c25118c',
                1000
              )}
              alt="Warm natural living space"
            />

            <div className="inspiration-quote">
              <span>“</span>

              <p>
                A home isn't just a place to live.
                It's a feeling you get to come back to.
              </p>

              <small>THE INTERIO PHILOSOPHY</small>
            </div>
          </section>

          {/* FOOTER */}

          <footer className="footer">
            <a className="footer-brand" href="#home">
              interio<span>.</span>
            </a>

            <span>Thoughtful spaces. Everyday living.</span>

            <span>DESIGNED WITH INTENTION · 2026</span>
          </footer>
        </div>
      </main>

      {/* SAVED PROJECT DETAIL VIEW */}

      {selectedProject && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Saved project details"
          onClick={event => {
            if (event.target === event.currentTarget) {
              setSelectedProject(null)
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(25, 25, 20, 0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 18,
              maxWidth: 900,
              width: '100%',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <button
              onClick={() => setSelectedProject(null)}
              aria-label="Close project"
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                zIndex: 2,
                width: 38,
                height: 38,
                border: 'none',
                borderRadius: '50%',
                background: '#fff',
                cursor: 'pointer',
                fontSize: 22,
              }}
            >
              ×
            </button>

            <img
              src={selectedProject.image}
              alt={selectedProject.name}
              style={{
                width: '100%',
                maxHeight: 550,
                objectFit: 'contain',
                display: 'block',
                background: '#f4f1eb',
              }}
            />

            <div style={{ padding: 25 }}>
              <div className="eyebrow">
                {selectedProject.generated
                  ? 'AI-GENERATED DESIGN'
                  : 'SAVED DESIGN'}
              </div>

              <h2 style={{ margin: '10px 0' }}>
                {selectedProject.style}
              </h2>

              <p style={{ color: '#777' }}>
                {selectedProject.room} · {selectedProject.budget}
              </p>

              <button
                className="save-button"
                onClick={() => setSelectedProject(null)}
                style={{ marginTop: 20 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
