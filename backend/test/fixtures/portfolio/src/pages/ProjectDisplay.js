import React from 'react'
import { useParams } from 'react-router-dom';
import { projectList } from '../helpers/ProjectList';
import GithubIcon from "@mui/icons-material/GitHub"
import "../styles/ProjectDisplay.css"

function ProjectDisplay() {
    const {id}=useParams();
    const projects = projectList[id];
  return (
    <div className='project'>
      <h1>{projects.name}</h1>
      <img src={projects.image} alt=''/>
      <p>
        <b>Skills:</b>{projects.skills}
      </p>
      <a href={projects.link} target="_blank" rel="noopener noreferrer">
        <GithubIcon />
      </a>
    </div>
  )
}

export default ProjectDisplay
