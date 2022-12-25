const db = require('../../connectors/db');
const roles = require('../../constants/roles');
const { getSessionToken } = require('../../utils/session');

const getUser = async function(req) {
  const sessionToken = getSessionToken(req);
  if (!sessionToken) {
    return res.status(301).redirect('/');
  }

  const user = await db.select('*')
    .from('se_project.sessions')
    .where('token', sessionToken)
    .innerJoin('se_project.users', 'se_project.sessions.userId', 'se_project.users.id')
    .innerJoin('se_project.roles', 'se_project.users.roleId', 'se_project.roles.id')
    .innerJoin('se_project.faculties', 'se_project.users.facultyId', 'se_project.faculties.id')
    .first();
  
  //console.log('user =>', user)
  user.isStudent = user.roleId === roles.student;
  user.isAdmin = user.roleId === roles.admin;

  return user;  
}

module.exports = function(app) {
  // Register HTTP endpoint to render /users page
  app.get('/dashboard', async function(req, res) {
    const user = await getUser(req);
    return res.render('dashboard', user);
  });

  // Register HTTP endpoint to render /users page
  app.get('/users', async function(req, res) {
    const users = await db.select(db.ref('id').withSchema('users'), 'firstName', 'lastName', 'faculty', 'role').from('se_project.users')
    .innerJoin('se_project.faculties', 'se_project.users.facultyId', 'se_project.faculties.id')
    .innerJoin('se_project.roles', 'se_project.users.roleId', 'se_project.roles.id');
    const user = await getUser(req);
    return res.render('users', { ...user, users });
  });

  // Register HTTP endpoint to render /courses page
  app.get('/courses', async function(req, res) {
    const user = await getUser(req);
    if (user.isStudent){
      const courses = await db.select('*').from('se_project.enrollments')
      .where('userId', user.id)
      .innerJoin('se_project.courses', 'se_project.enrollments.courseId', 'se_project.courses.id');
      return res.render('courses', { ...user, courses });
    }

    const courses = await db.select('*').from('se_project.courses');

    return res.render('courses', { ...user, courses });
  });

  // Register HTTP endpoint to render /enrollment page
  app.get('/enrollment', async function(req, res) {
    const user = await getUser(req);
    //console.log(user);
    const enrollment = await db.select('*')
    .from('se_project.enrollments')
    .where('userId', user.userId)
    .innerJoin('se_project.users', 'se_project.enrollments.userId', 'se_project.users.id')
    .innerJoin('se_project.courses', 'se_project.enrollments.courseId', 'se_project.courses.id')
    .innerJoin('se_project.faculties', 'se_project.users.facultyId', 'se_project.faculties.id');
    console.log(enrollment);
    return res.render('enrollment', { ...user, enrollment });
  });

  // Register HTTP endpoint to render /users/add page
  app.get('/users/add', async function(req, res) {
    const user = await getUser(req);
    if(!user.isAdmin) {
      return res.status(301).redirect('/dashboard'); 
    }
    const faculties = await db.select('*').from('se_project.faculties');
    return res.render('add-user', { faculties });
  });

  
};
