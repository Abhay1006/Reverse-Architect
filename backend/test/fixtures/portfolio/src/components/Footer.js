import React from 'react';
import { Link } from 'react-router-dom';
import InstagramIcon from "@mui/icons-material/Instagram";
import TwitterIcon from "@mui/icons-material/Twitter";
import FacebookIcon from "@mui/icons-material/Facebook";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import EmailIcon from "@mui/icons-material/Email";
import "../styles/Footer.css";

function Footer() {
  return (
    <div className='footer'>
      <div className='socialMedia'>
        <Link to="https://www.instagram.com/pratap_abhay.10/" target="_blank" rel="noopener noreferrer">
          <InstagramIcon />
        </Link>
        <Link to="https://www.facebook.com/ans.pratap" target="_blank" rel="noopener noreferrer">
          <FacebookIcon />
        </Link>
        <Link to="https://twitter.com/AbhayPrSi" target="_blank" rel="noopener noreferrer">
          <TwitterIcon />
        </Link>
        <Link to="https://www.linkedin.com/in/abhay-pratap-singh-a68698229/" target="_blank" rel="noopener noreferrer">
          <LinkedInIcon />
        </Link>
        <Link to="mailto:abhaypratapsingh1006@gmail.com">
          <EmailIcon />
        </Link>
      </div>
      <p>&copy; 2023 abhayportfolio.com</p>
    </div>
  );
}

export default Footer;
