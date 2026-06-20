import React from "react";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import EmailIcon from "@mui/icons-material/Email";
import GithubIcon from "@mui/icons-material/GitHub";
import "../styles/Home.css";

function Home() {
  return (
    <div className="home">
      <div className="about">
        <h2>Hi, My name is Abhay</h2>
        <div className="prompt">
          <p>
            A software developer with a passion for learning and problem
            solving.
          </p>
          <a
            href="https://www.linkedin.com/in/abhay-pratap-singh1006/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <LinkedInIcon />
          </a>
          <a
            href="mailto:abhaypratapsingh1006@gmail.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <EmailIcon />
          </a>
          <a
            href="https://github.com/Abhay1006"
            target="_blank"
            rel="noopener noreferrer"
          >
            <GithubIcon />
          </a>
        </div>
      </div>
      <div className="skills">
        <h1>Skills</h1>
        <ol className="list">
          <li className="item">
            <h2>Front-End</h2>
            <span>ReactJs, HTML, CSS, BootStrap, NestJs, TailwindCss</span>
          </li>
          <li className="item">
            <h2>Back-End</h2>
            <span>
              NodeJs, MySQL, Postgres, ExpressJs, NextJS, Docker, MongoDB,
              Prisma
            </span>
          </li>
          <li className="item">
            <h2>Languages</h2>
            <span>C, C++, Python, JavaScript, Java, GOLANG</span>
          </li>
        </ol>
      </div>
      <div className="resume">
        <a href="Abhay Pratap Singh.pdf" download className="resume-link">
          <button className="resume-button">Download Resume</button>
        </a>
      </div>
    </div>
  );
}

export default Home;
